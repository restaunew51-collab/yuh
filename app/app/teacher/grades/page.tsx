"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface AssessmentWithRelations {
  id: string;
  title: string;
  max_score: number;
  type: string;
  status: string;
  classes?: { name: string };
  subjects?: { name: string };
}

interface StudentRow {
  id: string;
  student_number: string;
  first_name: string | null;
  last_name: string | null;
}

interface GradeRow {
  id: string;
  score: number;
  status: string;
}

export default function TeacherGradesPage() {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<AssessmentWithRelations[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeRow>>({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: teacher } = await supabase.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
        if (!teacher) { setLoading(false); return; }

        const { data: asmts } = await supabase
          .from("assessments")
          .select("*, classes(name), subjects(name)")
          .order("date", { ascending: false });

        setAssessments((asmts ?? []) as AssessmentWithRelations[]);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedAssessment) return;
    (async () => {
      const asmt = assessments.find((a) => a.id === selectedAssessment);
      if (!asmt) return;

      const { data: enrRows } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("status", "active");

      const studentIds = (enrRows ?? []).map((e) => e.student_id);
      if (studentIds.length === 0) { setStudents([]); return; }

      const { data: studentRows } = await supabase
        .from("students")
        .select("id, student_number, first_name, last_name")
        .in("id", studentIds);

      setStudents((studentRows ?? []) as StudentRow[]);

      const { data: gradeRows } = await supabase
        .from("grades")
        .select("id, score, status, student_id")
        .eq("assessment_id", selectedAssessment);

      const gradeMap: Record<string, GradeRow> = {};
      const inputMap: Record<string, string> = {};
      for (const g of (gradeRows ?? []) as (GradeRow & { student_id: string })[]) {
        gradeMap[g.student_id] = { id: g.id, score: g.score, status: g.status };
        inputMap[g.student_id] = String(g.score);
      }
      setGrades(gradeMap);
      setScoreInputs(inputMap);
    })();
  }, [selectedAssessment, assessments]);

  const handleSave = async () => {
    if (!selectedAssessment) return;
    const asmt = assessments.find((a) => a.id === selectedAssessment);
    if (!asmt) return;
    setSaving(true);
    try {
      for (const student of students) {
        const scoreStr = scoreInputs[student.id];
        if (scoreStr === undefined || scoreStr === "") continue;
        const score = parseFloat(scoreStr);
        if (isNaN(score)) continue;

        const existing = grades[student.id];
        if (existing) {
          await supabase.from("grades").update({ score, status: "submitted" }).eq("id", existing.id);
        } else {
          await supabase.from("grades").insert({
            assessment_id: selectedAssessment,
            student_id: student.id,
            score,
            status: "submitted",
          });
        }
      }
      toast({ title: "Notes enregistrées", description: "Les notes ont été sauvegardées avec succès." });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer les notes.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div><PageHeader title="Saisie des notes" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Saisie des notes" description="Saisir les notes des évaluations" />
      {assessments.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucune évaluation" message="Aucune évaluation n'a été créée pour le moment." /></Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Sélectionner une évaluation</p>
            <div className="flex flex-wrap gap-2">
              {assessments.map((a) => (
                <Button
                  key={a.id}
                  variant={selectedAssessment === a.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAssessment(a.id)}
                >
                  {a.title} — {a.classes?.name ?? "—"}
                </Button>
              ))}
            </div>
          </Card>

          {selectedAssessment && students.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  {assessments.find((a) => a.id === selectedAssessment)?.title} —
                  Barème : {assessments.find((a) => a.id === selectedAssessment)?.max_score}
                </p>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Étudiant</TableHead>
                      <TableHead>Numéro</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.student_number}</TableCell>
                        <TableCell className="text-right">
                          <input
                            type="number"
                            step="0.25"
                            max={assessments.find((a) => a.id === selectedAssessment)?.max_score ?? 20}
                            className="w-20 text-right rounded border px-2 py-1 text-sm"
                            value={scoreInputs[s.id] ?? ""}
                            onChange={(e) => setScoreInputs({ ...scoreInputs, [s.id]: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={grades[s.id] ? "default" : "outline"}>
                            {grades[s.id] ? "Saisie" : "Nouvelle"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {selectedAssessment && students.length === 0 && (
            <Card className="p-6"><EmptyState title="Aucun étudiant" message="Aucun étudiant actif dans cette classe." /></Card>
          )}
        </div>
      )}
    </div>
  );
}
