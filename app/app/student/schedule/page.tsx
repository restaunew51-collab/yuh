"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";

const DAY_MAP: Record<number, string> = {
  1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche",
};

const DAYS = [1, 2, 3, 4, 5, 6];

export default function StudentSchedulePage() {
  const { schedules, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mon emploi du temps" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Mon emploi du temps" description="Planning de mes cours" />
      {schedules.length === 0 ? (
        <Card className="p-4"><EmptyState title="Aucune séance" message="Votre emploi du temps apparaîtra ici une fois votre inscription validée." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DAYS.map((dayNum) => {
            const daySchedules = schedules.filter((s) => s.day_of_week === dayNum);
            return (
              <Card key={dayNum} className="p-3">
                <h3 className="text-sm font-semibold mb-3">{DAY_MAP[dayNum]}</h3>
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Aucune séance</p>
                ) : (
                  <div className="space-y-2">
                    {daySchedules.map((s) => (
                      <div key={s.id} className="p-2 rounded-lg border bg-card">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                        </div>
                        <p className="text-sm font-medium">{s.subjects?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                        {s.room && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.room}</p>}
                        {s.teachers && <Badge variant="outline" className="mt-1 text-xs">{s.teachers.teacher_number}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
