"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Search, ClipboardCheck, Clock, Check, X, CircleAlert as AlertCircle, History } from "lucide-react";

type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

type ScheduleWithRelations = Schedule & {
  classes?: { name: string };
  subjects?: { name: string; code: string };
};

type EnrollmentWithStudent = Enrollment & {
  students?: { student_number: string };
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; color: string }> = {
  present: { label: "Present", variant: "default", color: "text-green-600" },
  absent: { label: "Absent", variant: "destructive", color: "text-red-600" },
  late: { label: "Retard", variant: "secondary", color: "text-amber-600" },
  excused: { label: "Justifie", variant: "outline", color: "text-blue-600" },
};

const DAY_MAP: Record<number, string> = {
  1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi", 7: "Dimanche",
};

type ViewMode = "take" | "history" | "stats";

export default function AttendancePage() {
  const { permissions, profile } = useAuth();
  const [view, setView] = useState<ViewMode>("take");
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");

  const canCreate = permissions.includes("attendance.create" as never);
  const canUpdate = permissions.includes("attendance.update" as never);

  useEffect(() => {
    if (profile?.institution_id) {
      supabase.from("classes").select("id, name").eq("institution_id", profile.institution_id).order("name")
        .then(({ data }) => setClasses(data ?? []));
    }
  }, [profile?.institution_id]);

  const fetchSchedules = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("schedules")
        .select("*, classes(name), subjects(name, code)")
        .eq("institution_id", profile.institution_id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (classFilter !== "all") query = query.eq("class_id", classFilter);

      const { data, error } = await query;
      if (error) throw error;
      setSchedules(data ?? []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, classFilter]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const filteredSchedules = schedules.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.subjects?.name ?? "").toLowerCase().includes(q) || (s.classes?.name ?? "").toLowerCase().includes(q);
  });

  if (loading && schedules.length === 0) {
    return <div><PageHeader title="Presences" description="Suivi des presences et absences" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Presences" description="Suivi des presences et absences" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant={view === "take" ? "default" : "outline"} size="sm" onClick={() => setView("take")}><ClipboardCheck className="w-4 h-4 mr-2" />Saisie</Button>
          <Button variant={view === "history" ? "default" : "outline"} size="sm" onClick={() => setView("history")}><History className="w-4 h-4 mr-2" />Historique</Button>
          <Button variant={view === "stats" ? "default" : "outline"} size="sm" onClick={() => setView("stats")}>Stats</Button>
        </div>
      </div>

      {view === "take" && <TakeAttendance schedules={filteredSchedules} canCreate={canCreate} canUpdate={canUpdate} profileId={profile?.id} />}
      {view === "history" && <AttendanceHistory schedules={filteredSchedules} />}
      {view === "stats" && <AttendanceStats schedules={filteredSchedules} />}
    </div>
  );
}

function TakeAttendance({
  schedules, canCreate, canUpdate, profileId,
}: {
  schedules: ScheduleWithRelations[];
  canCreate: boolean;
  canUpdate: boolean;
  profileId?: string;
}) {
  const { toast } = useToast();
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithRelations | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDetail = useCallback(async (schedule: ScheduleWithRelations, selDate: string) => {
    setLoadingDetail(true);
    try {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("*, students(student_number)")
        .eq("class_id", schedule.class_id)
        .eq("status", "active")
        .order("enrollment_date");
      setEnrollments(enr ?? []);

      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("schedule_id", schedule.id)
        .eq("date", selDate);
      const map: Record<string, Attendance> = {};
      for (const a of att ?? []) { map[a.student_id] = a; }
      setAttendanceMap(map);
    } catch {
      setEnrollments([]);
      setAttendanceMap({});
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSchedule) loadDetail(selectedSchedule, date);
  }, [selectedSchedule, date, loadDetail]);

  const setStudentStatus = async (studentId: string, status: string) => {
    if (!selectedSchedule) return;
    const existing = attendanceMap[studentId];
    try {
      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({ status, recorded_by: profileId ?? null })
          .eq("id", existing.id);
        if (error) throw error;
        setAttendanceMap({ ...attendanceMap, [studentId]: { ...existing, status: status as Attendance["status"] } });
      } else {
        const { data, error } = await supabase
          .from("attendance")
          .insert({
            schedule_id: selectedSchedule.id,
            student_id: studentId,
            academic_year_id: selectedSchedule.academic_year_id,
            date,
            status,
            recorded_by: profileId ?? null,
          })
          .select("*")
          .single();
        if (error) throw error;
        setAttendanceMap({ ...attendanceMap, [studentId]: data });
      }
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    }
  };

  const markAll = async (status: string) => {
    if (!selectedSchedule || !canCreate) return;
    setSaving(true);
    try {
      for (const enr of enrollments) {
        await setStudentStatus(enr.student_id, status);
      }
      toast({ title: "Presences enregistrees" });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedSchedule) {
    if (schedules.length === 0) {
      return <Card className="p-4"><EmptyState title="Aucune seance" message="Creez d'abord des seances dans le planning." /></Card>;
    }
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-3">Selectionnez une seance pour faire l'appel :</p>
        <div className="space-y-2">
          {schedules.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSchedule(s)}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-20 shrink-0"><Badge variant="outline">{DAY_MAP[s.day_of_week] ?? "?"}</Badge></div>
                <div>
                  <p className="text-sm font-medium">{s.subjects?.name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
              </div>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-medium">{selectedSchedule.subjects?.name} - {selectedSchedule.classes?.name}</h3>
          <p className="text-xs text-muted-foreground">{DAY_MAP[selectedSchedule.day_of_week]} {selectedSchedule.start_time.slice(0, 5)}-{selectedSchedule.end_time.slice(0, 5)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Button variant="outline" size="sm" onClick={() => setSelectedSchedule(null)}>Retour</Button>
        </div>
      </div>

      {canCreate && enrollments.length > 0 && (
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => markAll("present")} disabled={saving}>
            <Check className="w-4 h-4 mr-1 text-green-600" /> Tous presents
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAll("absent")} disabled={saving}>
            <X className="w-4 h-4 mr-1 text-red-600" /> Tous absents
          </Button>
        </div>
      )}

      {loadingDetail ? (
        <LoadingState />
      ) : enrollments.length === 0 ? (
        <EmptyState title="Aucun etudiant" message="Aucun etudiant actif dans cette classe." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Statut</TableHead>
                {canUpdate && <TableHead className="w-[300px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enr) => {
                const att = attendanceMap[enr.student_id];
                const status = att?.status ?? null;
                return (
                  <TableRow key={enr.id}>
                    <TableCell className="font-medium">{enr.students?.student_number ?? "-"}</TableCell>
                    <TableCell>
                      {status ? (
                        <Badge variant={STATUS_CONFIG[status]?.variant ?? "outline"}>{STATUS_CONFIG[status]?.label ?? status}</Badge>
                      ) : (
                        <Badge variant="outline">Non renseigne</Badge>
                      )}
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <div className="flex gap-1">
                          {Object.entries(STATUS_CONFIG).map(([code, cfg]) => (
                            <Button
                              key={code}
                              size="sm"
                              variant={status === code ? "default" : "outline"}
                              className={`h-8 px-2 text-xs ${status === code ? "" : cfg.color}`}
                              onClick={() => setStudentStatus(enr.student_id, code)}
                            >
                              {cfg.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function AttendanceHistory({ schedules }: { schedules: ScheduleWithRelations[] }) {
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithRelations | null>(null);
  const [records, setRecords] = useState<(Attendance & { students?: { student_number: string } })[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (schedule: ScheduleWithRelations) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("attendance")
        .select("*, students(student_number)")
        .eq("schedule_id", schedule.id)
        .order("date", { ascending: false })
        .order("student_id");
      setRecords(data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSchedule) loadHistory(selectedSchedule);
  }, [selectedSchedule, loadHistory]);

  if (!selectedSchedule) {
    if (schedules.length === 0) {
      return <Card className="p-4"><EmptyState title="Aucune seance" message="Creez d'abord des seances dans le planning." /></Card>;
    }
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-3">Selectionnez une seance pour voir l'historique :</p>
        <div className="space-y-2">
          {schedules.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSchedule(s)}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-20 shrink-0"><Badge variant="outline">{DAY_MAP[s.day_of_week] ?? "?"}</Badge></div>
                <div>
                  <p className="text-sm font-medium">{s.subjects?.name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                </div>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">{selectedSchedule.subjects?.name} - {selectedSchedule.classes?.name}</h3>
          <p className="text-xs text-muted-foreground">Historique des presences</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelectedSchedule(null)}>Retour</Button>
      </div>
      {loading ? (
        <LoadingState />
      ) : records.length === 0 ? (
        <EmptyState title="Aucun enregistrement" message="Aucune presence enregistree pour cette seance." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{new Date(r.date).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="font-medium">{r.students?.student_number ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_CONFIG[r.status]?.variant ?? "outline"}>{STATUS_CONFIG[r.status]?.label ?? r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function AttendanceStats({ schedules }: { schedules: ScheduleWithRelations[] }) {
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithRelations | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async (schedule: ScheduleWithRelations) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("attendance")
        .select("status")
        .eq("schedule_id", schedule.id);
      const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const r of data ?? []) { counts[r.status] = (counts[r.status] ?? 0) + 1; }
      setStats(counts);
    } catch {
      setStats({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSchedule) loadStats(selectedSchedule);
  }, [selectedSchedule, loadStats]);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  if (!selectedSchedule) {
    if (schedules.length === 0) {
      return <Card className="p-4"><EmptyState title="Aucune seance" message="Creez d'abord des seances dans le planning." /></Card>;
    }
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-3">Selectionnez une seance pour voir les statistiques :</p>
        <div className="space-y-2">
          {schedules.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSchedule(s)}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-20 shrink-0"><Badge variant="outline">{DAY_MAP[s.day_of_week] ?? "?"}</Badge></div>
                <div>
                  <p className="text-sm font-medium">{s.subjects?.name ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">{s.classes?.name ?? "-"}</p>
                </div>
              </div>
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">{selectedSchedule.subjects?.name} - {selectedSchedule.classes?.name}</h3>
          <p className="text-xs text-muted-foreground">Statistiques d'assiduite</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelectedSchedule(null)}>Retour</Button>
      </div>
      {loading ? (
        <LoadingState />
      ) : total === 0 ? (
        <EmptyState title="Aucune donnee" message="Aucune presence enregistree pour cette seance." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([code, cfg]) => {
            const count = stats[code] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <Card key={code} className="p-4 text-center">
                <p className={`text-3xl font-bold ${cfg.color}`}>{count}</p>
                <p className="text-sm text-muted-foreground mt-1">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{pct}%</p>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
