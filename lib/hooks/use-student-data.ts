"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Grade = Database["public"]["Tables"]["grades"]["Row"];
type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
type PaymentPlan = Database["public"]["Tables"]["payment_plans"]["Row"];
type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type Certificate = Database["public"]["Tables"]["certificates"]["Row"];

export type EnrollmentWithRelations = Enrollment & {
  courses?: { name: string; programs?: { name: string } };
  classes?: { name: string; capacity: number; room: string | null };
  academic_years?: { name: string };
};

export type ScheduleWithRelations = Schedule & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
  teachers?: { teacher_number: string; specialization: string | null };
};

export type AssessmentWithRelations = Assessment & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
};

export type GradeWithAssessment = Grade & {
  assessments?: AssessmentWithRelations;
};

export type PlanWithRelations = PaymentPlan & {
  courses?: { name: string };
  academic_years?: { name: string };
};

export interface StudentPortalData {
  student: Student | null;
  enrollments: EnrollmentWithRelations[];
  schedules: ScheduleWithRelations[];
  attendance: (Attendance & { schedules?: ScheduleWithRelations })[];
  grades: GradeWithAssessment[];
  paymentPlans: PlanWithRelations[];
  installments: Record<string, Installment[]>;
  payments: Record<string, Payment[]>;
  documents: Document[];
  notifications: Notification[];
  certificates: (Certificate & { courses?: { name: string } })[];
  loading: boolean;
  refresh: () => void;
}

export function useStudentData(): StudentPortalData {
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [attendance, setAttendance] = useState<(Attendance & { schedules?: ScheduleWithRelations })[]>([]);
  const [grades, setGrades] = useState<GradeWithAssessment[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PlanWithRelations[]>([]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [certificates, setCertificates] = useState<(Certificate & { courses?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: studentData } = await supabase
          .from("students")
          .select("*")
          .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .maybeSingle();
        if (cancelled || !studentData) { setLoading(false); return; }
        setStudent(studentData);

        const sid = studentData.id;

        const [enrRes, schRes, attRes, gradeRes, planRes, docRes, notifRes, certRes] = await Promise.all([
          supabase.from("enrollments").select("*, courses(name, programs(name)), classes(name, capacity, room), academic_years(name)").eq("student_id", sid).order("enrollment_date", { ascending: false }),
          supabase.from("schedules").select("*, classes(name), subjects(name, code), teachers(teacher_number, specialization)").order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
          supabase.from("attendance").select("*, schedules(*, classes(name), subjects(name, code), teachers(teacher_number, specialization))").eq("student_id", sid).order("date", { ascending: false }),
          supabase.from("grades").select("*, assessments(*, classes(name), subjects(name, code))").eq("student_id", sid).order("created_at", { ascending: false }),
          supabase.from("payment_plans").select("*, courses(name), academic_years(name)").eq("student_id", sid).order("created_at", { ascending: false }),
          supabase.from("document_students").select("document_id, documents(*)").eq("student_id", sid),
          supabase.from("notifications").select("*").eq("profile_id", studentData.profile_id ?? "").order("created_at", { ascending: false }).limit(50),
          supabase.from("certificates").select("*, courses(name)").eq("student_id", sid).order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;

        setEnrollments(enrRes.data ?? []);
        setSchedules(schRes.data ?? []);
        setAttendance(attRes.data ?? []);
        setGrades(gradeRes.data ?? []);
        setPaymentPlans(planRes.data ?? []);
        setDocuments((docRes.data ?? []).map((d: unknown) => (d as { documents: Document }).documents).filter(Boolean));
        setNotifications(notifRes.data ?? []);
        setCertificates(certRes.data ?? []);

        const instMap: Record<string, Installment[]> = {};
        const payMap: Record<string, Payment[]> = {};
        for (const plan of planRes.data ?? []) {
          const { data: insts } = await supabase.from("installments").select("*").eq("payment_plan_id", plan.id).order("installment_number", { ascending: true });
          instMap[plan.id] = insts ?? [];
          const instIds = (insts ?? []).map((i) => i.id);
          if (instIds.length > 0) {
            const { data: pays } = await supabase.from("payments").select("*").in("installment_id", instIds).order("payment_date", { ascending: false });
            payMap[plan.id] = pays ?? [];
          } else {
            payMap[plan.id] = [];
          }
        }
        if (!cancelled) { setInstallments(instMap); setPayments(payMap); }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return {
    student, enrollments, schedules, attendance, grades,
    paymentPlans, installments, payments, documents, notifications, certificates,
    loading, refresh,
  };
}
