"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function StudentEnrollmentsPage() {
  const { enrollments, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes inscriptions" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Mes inscriptions" description="Mes formations et classes" />
      {enrollments.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucune inscription" message="Vous n'êtes pas encore inscrit à une formation." /></Card>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{e.courses?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.academic_years?.name ?? "—"} — Classe : {e.classes?.name ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={e.status === "active" ? "default" : "outline"}>
                    {e.status === "active" ? "Active" : e.status === "pending" ? "En attente" : e.status === "completed" ? "Terminée" : e.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(e.enrollment_date).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
