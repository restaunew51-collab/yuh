"use client";

import { useTeacherData } from "@/lib/hooks/use-teacher-data";
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

export default function TeacherAssessmentsPage() {
  const { assessments, loading } = useTeacherData();

  if (loading) {
    return <div><PageHeader title="Évaluations" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Évaluations" description="Mes évaluations créées" />
      <Card className="p-4">
        {assessments.length === 0 ? (
          <EmptyState title="Aucune évaluation" message="Aucune évaluation n'a été créée pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Barème</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-muted-foreground">{a.subjects?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.classes?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABELS[a.type] ?? a.type}</Badge></TableCell>
                    <TableCell className="text-right">{a.max_score}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(a.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANTS[a.status] ?? "outline"}>{a.status === "draft" ? "Brouillon" : a.status === "published" ? "Publiée" : "Validée"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
