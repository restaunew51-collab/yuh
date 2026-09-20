"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type Course = Database["public"]["Tables"]["courses"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

const ENROLLMENT_STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Terminée" },
  { value: "withdrawn", label: "Retirée" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment?: Enrollment | null;
  onSaved?: () => void;
}

export function EnrollmentFormDialog({ open, onOpenChange, enrollment, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [courses, setCourses] = useState<(Course & { programs?: { name: string } })[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [studentId, setStudentId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("pending");
  const [enrollmentDate, setEnrollmentDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && profile?.institution_id) {
      supabase.from("students").select("*").eq("institution_id", profile.institution_id).order("student_number")
        .then(({ data }) => setStudents(data ?? []));
      supabase.from("academic_years").select("*").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [open, profile?.institution_id]);

  useEffect(() => {
    if (open && academicYearId && profile?.institution_id) {
      supabase
        .from("courses")
        .select("*, programs(name)")
        .eq("institution_id", profile.institution_id)
        .eq("academic_year_id", academicYearId)
        .order("name")
        .then(({ data }) => setCourses(data ?? []));
    } else {
      setCourses([]);
    }
    setCourseId("");
    setClassId("");
  }, [open, academicYearId, profile?.institution_id]);

  useEffect(() => {
    if (open && courseId) {
      supabase
        .from("classes")
        .select("*")
        .eq("course_id", courseId)
        .order("name")
        .then(({ data }) => setClasses(data ?? []));
    } else {
      setClasses([]);
    }
    setClassId("");
  }, [open, courseId]);

  useEffect(() => {
    if (open) {
      setStudentId(enrollment?.student_id ?? "");
      setAcademicYearId(enrollment?.academic_year_id ?? "");
      setCourseId(enrollment?.course_id ?? "");
      setClassId(enrollment?.class_id ?? "");
      setStatus(enrollment?.status ?? "pending");
      setEnrollmentDate(enrollment?.enrollment_date ?? new Date().toISOString().split("T")[0]);
      setErrors({});
    }
  }, [open, enrollment]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!studentId) e.studentId = "L'étudiant est requis";
    if (!academicYearId) e.academicYearId = "L'année académique est requise";
    if (!courseId) e.courseId = "Le cours est requis";
    if (!classId) e.classId = "La classe est requise";
    if (!enrollmentDate) e.enrollmentDate = "La date est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (enrollment) {
        const { error } = await supabase
          .from("enrollments")
          .update({ class_id: classId, status, enrollment_date: enrollmentDate })
          .eq("id", enrollment.id);
        if (error) throw error;
        toast({ title: "Inscription modifiée" });
      } else {
        const { error } = await supabase.from("enrollments").insert({
          student_id: studentId,
          course_id: courseId,
          class_id: classId,
          academic_year_id: academicYearId,
          enrollment_date: enrollmentDate,
          status,
        });
        if (error) throw error;
        toast({ title: "Inscription créée" });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{enrollment ? "Modifier l'inscription" : "Nouvelle inscription"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enr-student">Étudiant *</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={loading || !!enrollment}>
              <SelectTrigger id="enr-student"><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.student_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.studentId && <p className="text-xs text-destructive">{errors.studentId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="enr-year">Année académique *</Label>
            <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={loading || !!enrollment}>
              <SelectTrigger id="enr-year"><SelectValue placeholder="Sélectionner une année" /></SelectTrigger>
              <SelectContent>
                {academicYears.map((ay) => (
                  <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.academicYearId && <p className="text-xs text-destructive">{errors.academicYearId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="enr-course">Cours / Formation *</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={loading || !academicYearId || !!enrollment}>
              <SelectTrigger id="enr-course"><SelectValue placeholder="Sélectionner un cours" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.programs ? ` (${c.programs.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.courseId && <p className="text-xs text-destructive">{errors.courseId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="enr-class">Classe *</Label>
            <Select value={classId} onValueChange={setClassId} disabled={loading || !courseId}>
              <SelectTrigger id="enr-class"><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} (cap. {c.capacity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="enr-date">Date d'inscription *</Label>
              <Input id="enr-date" type="date" value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} disabled={loading} />
              {errors.enrollmentDate && <p className="text-xs text-destructive">{errors.enrollmentDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="enr-status">Statut</Label>
              <Select value={status} onValueChange={setStatus} disabled={loading}>
                <SelectTrigger id="enr-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENROLLMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {enrollment ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ENROLLMENT_STATUS_OPTIONS };
