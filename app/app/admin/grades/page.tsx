"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AssessmentFormDialog, ASSESSMENT_TYPE_OPTIONS, ASSESSMENT_STATUS_OPTIONS } from "@/components/academic/assessment-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Plus, MoveHorizontal as MoreHorizontal, Pencil, Trash2, Award, Eye, Save } from "lucide-react";

type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
type Grade = Database["public"]["Tables"]["grades"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

type AssessmentWithRelations = Assessment & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
};

type EnrollmentWithStudent = Enrollment & {
  students?: { student_number: string };
};

type GradeWithStudent = Grade & {
  students?: { student_number: string };
};

const TYPE_LABELS: Record<string, string> = {
  exam: "Examen", quiz: "Interrogation", homework: "Devoir", project: "Projet",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline", published: "default", validated: "secondary",
};

export default function AssessmentsPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<AssessmentWithRelations[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [deleting, setDeleting] = useState<Assessment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [gradeDialogAssessment, setGradeDialogAssessment] = useState<AssessmentWithRelations | null>(null);

  const canCreate = permissions.includes("assessments.create" as never);
  const canUpdate = permissions.includes("assessments.update" as never);
  const canDelete = permissions.includes("assessments.delete" as never);
  const canGrade = permissions.includes("grades.create" as never) || permissions.includes("grades.update" as never);

  useEffect(() => {
    if (profile?.institution_id) {
      supabase.from("classes").select("id, name").eq("institution_id", profile.institution_id).order("name")
        .then(({ data }) => setClasses(data ?? []));
      supabase.from("academic_years").select("id, name").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [profile?.institution_id]);

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      const classIds = (await supabase.from("classes").select("id").eq("institution_id", profile.institution_id)).data?.map((r: { id: string }) => r.id) ?? [];
      if (classIds.length === 0) { setItems([]); return; }

      let query = supabase
        .from("assessments")
        .select("*, classes(name), subjects(name, code)")
        .in("class_id", classIds)
        .order("date", { ascending: false });

      if (classFilter !== "all") query = query.eq("class_id", classFilter);
      if (yearFilter !== "all") query = query.eq("academic_year_id", yearFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, classFilter, yearFilter, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("assessments").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Evaluation supprimee" });
      setDeleting(null);
      fetch();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && items.length === 0) {
    return <div><PageHeader title="Evaluations" description="Examens, devoirs et notes" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Examens, devoirs et notes"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle evaluation
          </Button>
        )}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Toutes les annees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les annees</SelectItem>
              {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {ASSESSMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="Aucune evaluation" message="Creez une evaluation pour saisir des notes." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        </Card>
      ) : (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Matiere</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bareme</TableHead>
                  <TableHead>Coef.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-muted-foreground">{a.classes?.name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.subjects?.name ?? "-"}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[a.type] ?? a.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{a.max_score}</TableCell>
                    <TableCell className="text-muted-foreground">{a.coefficient}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(a.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANTS[a.status] ?? "outline"}>{ASSESSMENT_STATUS_OPTIONS.find((o) => o.value === a.status)?.label ?? a.status}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canGrade && (
                            <DropdownMenuItem onClick={() => setGradeDialogAssessment(a)}>
                              <Award className="w-4 h-4 mr-2" /> Saisir les notes
                            </DropdownMenuItem>
                          )}
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => { setEditing(a); setFormOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(a)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <AssessmentFormDialog open={formOpen} onOpenChange={setFormOpen} assessment={editing} onSaved={fetch} />

      {gradeDialogAssessment && (
        <GradeEntryDialog
          assessment={gradeDialogAssessment}
          open={!!gradeDialogAssessment}
          onOpenChange={(o) => !o && setGradeDialogAssessment(null)}
          profileId={profile?.id}
          onSaved={fetch}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette evaluation ?</AlertDialogTitle>
            <AlertDialogDescription>Cela supprimera aussi les notes associees. Cette action est irreversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GradeEntryDialog({
  assessment, open, onOpenChange, profileId, onSaved,
}: {
  assessment: AssessmentWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeWithStudent>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: enr } = await supabase
          .from("enrollments")
          .select("*, students(student_number)")
          .eq("class_id", assessment.class_id)
          .eq("status", "active")
          .order("enrollment_date");
        if (cancelled) return;
        setEnrollments(enr ?? []);

        const { data: existingGrades } = await supabase
          .from("grades")
          .select("*, students(student_number)")
          .eq("assessment_id", assessment.id);
        if (cancelled) return;
        const gradeMap: Record<string, GradeWithStudent> = {};
        const scoreMap: Record<string, string> = {};
        for (const g of existingGrades ?? []) {
          gradeMap[g.student_id] = g;
          scoreMap[g.student_id] = String(g.score);
        }
        setGrades(gradeMap);
        setScores(scoreMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, assessment.id, assessment.class_id]);

  const saveGrade = async (studentId: string) => {
    const scoreStr = scores[studentId];
    if (scoreStr === undefined || scoreStr === "") return;
    const score = parseFloat(scoreStr);
    if (isNaN(score) || score < 0 || score > assessment.max_score) {
      toast({ title: "Note invalide", description: `La note doit etre entre 0 et ${assessment.max_score}.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const existing = grades[studentId];
      if (existing) {
        const { error } = await supabase
          .from("grades")
          .update({ score, status: "draft", graded_by: profileId ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("grades")
          .insert({
            assessment_id: assessment.id,
            student_id: studentId,
            academic_year_id: assessment.academic_year_id,
            score,
            status: "draft",
            graded_by: profileId ?? null,
          })
          .select("*")
          .single();
        if (error) throw error;
        setGrades({ ...grades, [studentId]: data });
      }
      toast({ title: "Note enregistree" });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const enr of enrollments) {
        const scoreStr = scores[enr.student_id];
        if (scoreStr !== undefined && scoreStr !== "") {
          const score = parseFloat(scoreStr);
          if (!isNaN(score) && score >= 0 && score <= assessment.max_score) {
            const existing = grades[enr.student_id];
            if (existing) {
              await supabase.from("grades").update({ score, graded_by: profileId ?? null }).eq("id", existing.id);
            } else {
              await supabase.from("grades").insert({
                assessment_id: assessment.id,
                student_id: enr.student_id,
                academic_year_id: assessment.academic_year_id,
                score,
                status: "draft",
                graded_by: profileId ?? null,
              });
            }
          }
        }
      }
      toast({ title: "Toutes les notes enregistrees" });
      onSaved?.();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Saisie des notes - {assessment.title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <LoadingState />
        ) : enrollments.length === 0 ? (
          <EmptyState title="Aucun etudiant" message="Aucun etudiant actif dans cette classe." />
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Bareme: {assessment.max_score} | Coefficient: {assessment.coefficient}</p>
              <Button size="sm" onClick={saveAll} disabled={saving}>
                <Save className="w-4 h-4 mr-2" /> Tout enregistrer
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Note / {assessment.max_score}</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enr) => (
                    <TableRow key={enr.id}>
                      <TableCell className="font-medium">{enr.students?.student_number ?? "-"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={assessment.max_score}
                          step="0.25"
                          value={scores[enr.student_id] ?? ""}
                          onChange={(e) => setScores({ ...scores, [enr.student_id]: e.target.value })}
                          className="w-24"
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => saveGrade(enr.student_id)} disabled={saving}>
                          <Save className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
