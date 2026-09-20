"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  present: { label: "Présent", variant: "default" },
  absent: { label: "Absent", variant: "destructive" },
  late: { label: "Retard", variant: "secondary" },
  excused: { label: "Justifié", variant: "outline" },
};

export default function StudentAttendancePage() {
  const { attendance, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes présences" /><LoadingState /></div>;
  }

  const stats: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const a of attendance) { stats[a.status] = (stats[a.status] ?? 0) + 1; }

  return (
    <div>
      <PageHeader title="Mes présences" description="Suivi de mes présences et absences" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([code, cfg]) => (
          <Card key={code} className="p-4 text-center">
            <p className="text-2xl font-bold">{stats[code] ?? 0}</p>
            <p className="text-sm text-muted-foreground">{cfg.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        {attendance.length === 0 ? (
          <EmptyState title="Aucune présence" message="Aucun enregistrement de présence pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{new Date(a.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="font-medium">{a.schedules?.subjects?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.schedules?.classes?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[a.status]?.variant ?? "outline"}>
                        {STATUS_CONFIG[a.status]?.label ?? a.status}
                      </Badge>
                    </TableCell>
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
