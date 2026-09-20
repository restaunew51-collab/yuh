"use client";

import { useTeacherData } from "@/lib/hooks/use-teacher-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Users, MapPin, BookOpen } from "lucide-react";

export default function TeacherClassesPage() {
  const { classes, loading } = useTeacherData();

  if (loading) {
    return <div><PageHeader title="Mes classes" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Mes classes" description="Classes qui me sont assignées" />
      {classes.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucune classe" message="Aucune classe ne vous est assignée pour le moment." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <BookOpen className="w-3 h-3" />{c.courseName}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">{c.studentCount} / {c.capacity} étudiants</span>
                    {c.room && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.room}</span>}
                    <span className="text-xs text-muted-foreground">{c.scheduleCount} séance(s)</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
