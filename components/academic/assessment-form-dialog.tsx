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
import { Loader as Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

const ASSESSMENT_TYPE_OPTIONS = [
  { value: "exam", label: "Examen" },
  { value: "quiz", label: "Interrogation" },
  { value: "homework", label: "Devoir" },
  { value: "project", label: "Projet" },
];

const ASSESSMENT_STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publie" },
  { value: "validated", label: "Valide" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment?: Assessment | null;
  onSaved?: () => void;
}

export function AssessmentFormDialog({ open, onOpenChange, assessment, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [type, setType] = useState("exam");
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("20");
  const [coefficient, setCoefficient] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("draft");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && profile?.institution_id) {
      supabase.from("classes").select("*").eq("institution_id", profile.institution_id).order("name")
        .then(({ data }) => setClasses(data ?? []));
      supabase.from("academic_years").select("*").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [open, profile?.institution_id]);

  useEffect(() => {
    if (!open || !classId) {
      if (open) setSubjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase
        .from("classes")
        .select("course_id")
        .eq("id", classId)
        .maybeSingle();
      if (!cls?.course_id) { if (!cancelled) setSubjects([]); return; }
      const { data: course } = await supabase
        .from("courses")
        .select("program_id")
        .eq("id", cls.course_id)
        .maybeSingle();
      if (!course?.program_id) { if (!cancelled) setSubjects([]); return; }
      const { data: mods } = await supabase
        .from("modules")
        .select("id")
        .eq("program_id", course.program_id);
      const moduleIds = (mods ?? []).map((m: { id: string }) => m.id);
      if (moduleIds.length === 0) { if (!cancelled) setSubjects([]); return; }
      const { data: subjData } = await supabase
        .from("subjects")
        .select("*")
        .in("module_id", moduleIds)
        .order("name");
      if (!cancelled) setSubjects(subjData ?? []);
    })();
    return () => { cancelled = true; };
  }, [open, classId]);

  useEffect(() => {
    if (open) {
      setClassId(assessment?.class_id ?? "");
      setSubjectId(assessment?.subject_id ?? "");
      setAcademicYearId(assessment?.academic_year_id ?? "");
      setType(assessment?.type ?? "exam");
      setTitle(assessment?.title ?? "");
      setMaxScore(String(assessment?.max_score ?? "20"));
      setCoefficient(String(assessment?.coefficient ?? "1"));
      setDate(assessment?.date ?? new Date().toISOString().split("T")[0]);
      setStatus(assessment?.status ?? "draft");
      setErrors({});
    }
  }, [open, assessment]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!classId) e.classId = "La classe est requise";
    if (!subjectId) e.subjectId = "La matiere est requise";
    if (!academicYearId) e.academicYearId = "L'annee academique est requise";
    if (!title.trim()) e.title = "Le titre est requis";
    const ms = parseFloat(maxScore);
    if (isNaN(ms) || ms <= 0) e.maxScore = "Le bareme doit etre > 0";
    const c = parseFloat(coefficient);
    if (isNaN(c) || c <= 0) e.coefficient = "Le coefficient doit etre > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        class_id: classId,
        subject_id: subjectId,
        academic_year_id: academicYearId,
        type,
        title: title.trim(),
        max_score: parseFloat(maxScore),
        coefficient: parseFloat(coefficient),
        date,
        status,
        created_by: profile?.id ?? "",
      };

      if (assessment) {
        const { error } = await supabase.from("assessments").update({
          class_id: classId,
          subject_id: subjectId,
          academic_year_id: academicYearId,
          type, title: title.trim(),
          max_score: parseFloat(maxScore),
          coefficient: parseFloat(coefficient),
          date, status,
        }).eq("id", assessment.id);
        if (error) throw error;
        toast({ title: "Evaluation modifiee" });
      } else {
        const { error } = await supabase.from("assessments").insert(payload);
        if (error) throw error;
        toast({ title: "Evaluation creee" });
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
          <DialogTitle>{assessment ? "Modifier l'evaluation" : "Nouvelle evaluation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="as-title">Titre *</Label>
            <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} placeholder="Examen final" autoFocus />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="as-class">Classe *</Label>
              <Select value={classId} onValueChange={setClassId} disabled={loading || !!assessment}>
                <SelectTrigger id="as-class"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-subject">Matiere *</Label>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={loading || !classId || !!assessment}>
                <SelectTrigger id="as-subject"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="as-year">Annee academique *</Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={loading || !!assessment}>
                <SelectTrigger id="as-year"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.academicYearId && <p className="text-xs text-destructive">{errors.academicYearId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-type">Type *</Label>
              <Select value={type} onValueChange={setType} disabled={loading}>
                <SelectTrigger id="as-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="as-maxscore">Bareme *</Label>
              <Input id="as-maxscore" type="number" min="0.1" step="0.5" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} disabled={loading} />
              {errors.maxScore && <p className="text-xs text-destructive">{errors.maxScore}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-coef">Coefficient *</Label>
              <Input id="as-coef" type="number" min="0.1" step="0.1" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} disabled={loading} />
              {errors.coefficient && <p className="text-xs text-destructive">{errors.coefficient}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-date">Date *</Label>
              <Input id="as-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="as-status">Statut</Label>
            <Select value={status} onValueChange={setStatus} disabled={loading}>
              <SelectTrigger id="as-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {assessment ? "Enregistrer" : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ASSESSMENT_TYPE_OPTIONS, ASSESSMENT_STATUS_OPTIONS };
