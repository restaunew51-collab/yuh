"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPE_LABELS: Record<string, string> = {
  exam: "Examen", quiz: "Interrogation", homework: "Devoir", project: "Projet",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline", submitted: "default", validated: "secondary",
};

export default function StudentGradesPage() {
  const { grades, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes notes" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Mes notes" description="Résultats de mes évaluations" />
      <Card className="p-4">
        {grades.length === 0 ? (
          <EmptyState title="Aucune note" message="Aucune note n'a été publiée pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Évaluation</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Note</TableHead>
                  <TableHead className="text-right">Barème</TableHead>
                  <TableHead className="text-right">/20</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((g) => {
                  const maxScore = g.assessments?.max_score ?? 20;
                  const normalized = maxScore > 0 ? (g.score / maxScore) * 20 : 0;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.assessments?.title ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{g.assessments?.subjects?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{g.assessments?.classes?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABELS[g.assessments?.type ?? ""] ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{g.score}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{maxScore}</TableCell>
                      <TableCell className="text-right"><Badge variant={normalized >= 10 ? "default" : "destructive"}>{normalized.toFixed(2)}</Badge></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANTS[g.status] ?? "outline"}>{g.status === "draft" ? "Brouillon" : g.status === "submitted" ? "Saisie" : "Validée"}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
