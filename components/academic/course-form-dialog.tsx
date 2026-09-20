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

type Course = Database["public"]["Tables"]["courses"]["Row"];
type Program = Database["public"]["Tables"]["programs"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

const COURSE_STATUS_OPTIONS = [
  { value: "planned", label: "Planifié" },
  { value: "active", label: "Ouvert" },
  { value: "completed", label: "Terminé" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSaved?: () => void;
}

export function CourseFormDialog({ open, onOpenChange, course, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [tuitionFee, setTuitionFee] = useState("0");
  const [enrollmentFee, setEnrollmentFee] = useState("0");
  const [status, setStatus] = useState("planned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && profile?.institution_id) {
      supabase.from("programs").select("*").eq("institution_id", profile.institution_id).eq("is_active", true).order("name")
        .then(({ data }) => setPrograms(data ?? []));
      supabase.from("academic_years").select("*").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [open, profile?.institution_id]);

  useEffect(() => {
    if (open) {
      setName(course?.name ?? "");
      setProgramId(course?.program_id ?? "");
      setAcademicYearId(course?.academic_year_id ?? "");
      setTuitionFee(String(course?.tuition_fee ?? "0"));
      setEnrollmentFee(String(course?.enrollment_fee ?? "0"));
      setStatus(course?.status ?? "planned");
      setStartDate(course?.start_date ?? "");
      setEndDate(course?.end_date ?? "");
      setErrors({});
    }
  }, [open, course]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!programId) e.programId = "Le programme est requis";
    if (!academicYearId) e.academicYearId = "L'année académique est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) return;

    setLoading(true);
    try {
      const payload = {
        institution_id: profile.institution_id,
        program_id: programId,
        academic_year_id: academicYearId,
        name: name.trim(),
        tuition_fee: parseFloat(tuitionFee) || 0,
        enrollment_fee: parseFloat(enrollmentFee) || 0,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
      };

      if (course) {
        const { error } = await supabase.from("courses").update(payload).eq("id", course.id);
        if (error) throw error;
        toast({ title: "Cours modifié" });
      } else {
        const { error } = await supabase.from("courses").insert(payload);
        if (error) throw error;
        toast({ title: "Cours créé" });
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
          <DialogTitle>{course ? "Modifier le cours" : "Nouveau cours"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-name">Nom *</Label>
            <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course-program">Programme *</Label>
              <Select value={programId} onValueChange={setProgramId} disabled={loading}>
                <SelectTrigger id="course-program"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.programId && <p className="text-xs text-destructive">{errors.programId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-ay">Année académique *</Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={loading}>
                <SelectTrigger id="course-ay"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.academicYearId && <p className="text-xs text-destructive">{errors.academicYearId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course-tuition">Frais de formation</Label>
              <Input id="course-tuition" type="number" min="0" value={tuitionFee} onChange={(e) => setTuitionFee(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-enrollment">Frais d'inscription</Label>
              <Input id="course-enrollment" type="number" min="0" value={enrollmentFee} onChange={(e) => setEnrollmentFee(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course-status">Statut</Label>
              <Select value={status} onValueChange={setStatus} disabled={loading}>
                <SelectTrigger id="course-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURSE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-start">Début</Label>
              <Input id="course-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-end">Fin</Label>
              <Input id="course-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {course ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { COURSE_STATUS_OPTIONS };
