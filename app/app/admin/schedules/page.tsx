"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ScheduleFormDialog, DAY_OPTIONS } from "@/components/academic/schedule-form-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Plus, MoveHorizontal as MoreHorizontal, Pencil, Trash2, Clock, MapPin } from "lucide-react";

type Schedule = Database["public"]["Tables"]["schedules"]["Row"];

type ScheduleWithRelations = Schedule & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
  teachers?: { teacher_number: string; specialization: string | null };
};

const DAY_MAP: Record<number, string> = {
  1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche",
};

export default function SchedulesPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScheduleWithRelations[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [view, setView] = useState<"week" | "list">("week");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = permissions.includes("schedules.create" as never);
  const canUpdate = permissions.includes("schedules.update" as never);
  const canDelete = permissions.includes("schedules.delete" as never);

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
      let query = supabase
        .from("schedules")
        .select("*, classes(name), subjects(name, code), teachers(teacher_number, specialization)")
        .eq("institution_id", profile.institution_id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (classFilter !== "all") query = query.eq("class_id", classFilter);
      if (yearFilter !== "all") query = query.eq("academic_year_id", yearFilter);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, classFilter, yearFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("schedules").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Seance supprimee" });
      setDeleting(null);
      fetch();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const schedulesByDay = (day: number) => items.filter((s) => s.day_of_week === day);

  if (loading && items.length === 0) {
    return <div><PageHeader title="Planning" description="Emploi du temps des classes" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Planning"
        description="Emploi du temps des classes"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle seance
          </Button>
        )}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Toutes les annees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les annees</SelectItem>
              {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>Vue semaine</Button>
            <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>Vue liste</Button>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="Aucune seance" message="Creez des seances pour construire l'emploi du temps." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        </Card>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DAY_OPTIONS.filter((d) => parseInt(d.value) <= 6).map((dayOpt) => {
            const dayNum = parseInt(dayOpt.value);
            const daySchedules = schedulesByDay(dayNum);
            return (
              <Card key={dayOpt.value} className="p-3">
                <h3 className="text-sm font-semibold mb-3">{dayOpt.label}</h3>
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Aucune seance</p>
                ) : (
                  <div className="space-y-2">
                    {daySchedules.map((s) => (
                      <div key={s.id} className="p-2 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                        </div>
                        <p className="text-sm font-medium">{s.subjects?.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                        {s.room && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.room}</p>}
                        {s.teachers && <Badge variant="outline" className="mt-1 text-xs">{s.teachers.teacher_number}</Badge>}
                        {canUpdate && (
                          <div className="mt-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-3 h-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditing(s); setFormOpen(true); }}>
                                  <Pencil className="w-3 h-3 mr-2" /> Modifier
                                </DropdownMenuItem>
                                {canDelete && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(s)}>
                                    <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4">
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <Badge variant="outline">{DAY_MAP[s.day_of_week] ?? "?"}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.subjects?.name ?? "-"} <span className="text-muted-foreground">({s.subjects?.code})</span></p>
                    <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                    {s.room && <p className="text-xs text-muted-foreground">Salle {s.room}</p>}
                  </div>
                  {s.teachers && <Badge variant="outline">{s.teachers.teacher_number}</Badge>}
                  {canUpdate && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(s); setFormOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Modifier
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(s)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editing}
        classId={classFilter !== "all" ? classFilter : undefined}
        academicYearId={yearFilter !== "all" ? yearFilter : undefined}
        onSaved={fetch}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette seance ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irreversible.</AlertDialogDescription>
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
