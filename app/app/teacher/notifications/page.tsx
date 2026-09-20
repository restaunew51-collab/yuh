"use client";

import { useTeacherData } from "@/lib/hooks/use-teacher-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function TeacherNotificationsPage() {
  const { notifications, loading } = useTeacherData();

  if (loading) {
    return <div><PageHeader title="Notifications" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Mes alertes et messages" />
      {notifications.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucune notification" message="Vous n'avez aucune notification." /></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`p-4 ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.is_read ? "bg-primary" : "bg-muted"}`}>
                  <Bell className={`w-4 h-4 ${!n.is_read ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
