"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

export default function StudentBulletinsPage() {
  const { grades, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes bulletins" /><LoadingState /></div>;
  }

  const bySubject: Record<string, { name: string; grades: typeof grades; avg: number }> = {};
  for (const g of grades) {
    const subjName = g.assessments?.subjects?.name ?? "—";
    if (!bySubject[subjName]) bySubject[subjName] = { name: subjName, grades: [], avg: 0 };
    bySubject[subjName].grades.push(g);
  }
  for (const key of Object.keys(bySubject)) {
    const gs = bySubject[key].grades;
    const total = gs.reduce((s, g) => {
      const max = g.assessments?.max_score ?? 20;
      return s + (max > 0 ? (g.score / max) * 20 : 0);
    }, 0);
    bySubject[key].avg = gs.length > 0 ? total / gs.length : 0;
  }

  const subjectList = Object.values(bySubject);
  const overallAvg = subjectList.length > 0 ? subjectList.reduce((s, sub) => s + sub.avg, 0) / subjectList.length : 0;

  return (
    <div>
      <PageHeader title="Mes bulletins" description="Synthèse de mes résultats par matière" />
      {subjectList.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucun bulletin" message="Aucune note n'a été publiée pour le moment." /></Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moyenne générale</p>
                <p className="text-2xl font-bold">{overallAvg.toFixed(2)} / 20</p>
              </div>
              <Badge variant={overallAvg >= 10 ? "default" : "destructive"} className="ml-auto">
                {overallAvg >= 10 ? "Admis" : "Insuffisant"}
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectList.map((sub) => (
              <Card key={sub.name} className="p-4">
                <p className="text-sm font-medium mb-1">{sub.name}</p>
                <p className="text-xs text-muted-foreground mb-2">{sub.grades.length} évaluation(s)</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{sub.avg.toFixed(2)}</span>
                  <Badge variant={sub.avg >= 10 ? "default" : "destructive"}>/ 20</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
