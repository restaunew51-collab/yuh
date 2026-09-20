"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Teacher = Database["public"]["Tables"]["teachers"]["Row"];
type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
type Grade = Database["public"]["Tables"]["grades"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export type TeacherSchedule = Schedule & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
};

export type TeacherAssessment = Assessment & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
};

export type TeacherClassInfo = {
  id: string;
  name: string;
  capacity: number;
  room: string | null;
  courseName: string;
  studentCount: number;
  scheduleCount: number;
};

export interface TeacherPortalData {
  teacher: Teacher | null;
  classes: TeacherClassInfo[];
  schedules: TeacherSchedule[];
  assessments: TeacherAssessment[];
  attendance: (Attendance & { schedules?: TeacherSchedule })[];
  documents: Document[];
  notifications: Notification[];
  loading: boolean;
  refresh: () => void;
}

export function useTeacherData(): TeacherPortalData {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<TeacherClassInfo[]>([]);
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);
  const [attendance, setAttendance] = useState<(Attendance & { schedules?: TeacherSchedule })[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: teacherData } = await supabase
          .from("teachers")
          .select("*")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (cancelled || !teacherData) { setLoading(false); return; }
        setTeacher(teacherData);

        const [schRes, asmtRes, attRes, docRes, notifRes] = await Promise.all([
          supabase.from("schedules").select("*, classes(name), subjects(name, code)").eq("teacher_id", teacherData.id).order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
          supabase.from("assessments").select("*, classes(name), subjects(name, code)").order("date", { ascending: false }),
          supabase.from("attendance").select("*, schedules(*, classes(name), subjects(name, code))").order("date", { ascending: false }).limit(100),
          supabase.from("document_teachers").select("document_id, documents(*)").eq("teacher_id", teacherData.id),
          supabase.from("notifications").select("*").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(50),
        ]);

        if (cancelled) return;

        setSchedules(schRes.data ?? []);
        setAssessments(asmtRes.data ?? []);
        setAttendance(attRes.data ?? []);
        setDocuments((docRes.data ?? []).map((d: unknown) => (d as { documents: Document }).documents).filter(Boolean));
        setNotifications(notifRes.data ?? []);

        const classIds = Array.from(new Set((schRes.data ?? []).map((s) => s.class_id)));
        if (classIds.length > 0) {
          const { data: classRows } = await supabase
            .from("classes")
            .select("*, courses(name)")
            .in("id", classIds);

          const classInfos: TeacherClassInfo[] = [];
          for (const c of classRows ?? []) {
            const { count: studentCount } = await supabase
              .from("enrollments")
              .select("*", { count: "exact", head: true })
              .eq("class_id", c.id)
              .eq("status", "active");
            const scheduleCount = (schRes.data ?? []).filter((s) => s.class_id === c.id).length;
            classInfos.push({
              id: c.id,
              name: c.name,
              capacity: c.capacity,
              room: c.room,
              courseName: (c as unknown as { courses: { name: string } }).courses?.name ?? "—",
              studentCount: studentCount ?? 0,
              scheduleCount,
            });
          }
          if (!cancelled) setClasses(classInfos);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return {
    teacher, classes, schedules, assessments, attendance,
    documents, notifications, loading, refresh,
  };
}
