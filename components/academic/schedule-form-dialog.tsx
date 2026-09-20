"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader as Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type Teacher = Database["public"]["Tables"]["teachers"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];

const DAY_OPTIONS = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
  { value: "7", label: "Dimanche" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
  classId?: string;
  academicYearId?: string;
  onSaved?: () => void;
}

export function ScheduleFormDialog({ open, onOpenChange, schedule, classId, academicYearId, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [selClassId, setSelClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("none");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");
  const [selAcademicYearId, setSelAcademicYearId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && profile?.institution_id) {
      supabase.from("teachers").select("*").eq("institution_id", profile.institution_id).eq("status", "active").order("teacher_number")
        .then(({ data }) => setTeachers(data ?? []));
      supabase.from("classes").select("*").eq("institution_id", profile.institution_id).order("name")
        .then(({ data }) => setClasses(data ?? []));
    }
  }, [open, profile?.institution_id]);

  useEffect(() => {
    if (!open || !selClassId) {
      if (open) setSubjects([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase
        .from("classes")
        .select("course_id")
        .eq("id", selClassId)
        .maybeSingle();
      if (!cls?.course_id) { if (!cancelled) setSubjects([]); return; }
      const { data: course } = await supabase
        .from("courses")
        .select("program_id")
        .eq("id", cls.course_id)
        .maybeSingle();
      if (!course?.program_id) { if (!cancelled) setSubjects([]); return; }
      const { data: mods } = await supabase
        .from("modules")
        .select("id")
        .eq("program_id", course.program_id);
      const moduleIds = (mods ?? []).map((m: { id: string }) => m.id);
      if (moduleIds.length === 0) { if (!cancelled) setSubjects([]); return; }
      const { data: subjData } = await supabase
        .from("subjects")
        .select("*")
        .in("module_id", moduleIds)
        .order("name");
      if (!cancelled) setSubjects(subjData ?? []);
    })();
    return () => { cancelled = true; };
  }, [open, selClassId]);

  useEffect(() => {
    if (open) {
      setSelClassId(schedule?.class_id ?? classId ?? "");
      setSubjectId(schedule?.subject_id ?? "");
      setTeacherId(schedule?.teacher_id ?? "none");
      setDayOfWeek(String(schedule?.day_of_week ?? "1"));
      setStartTime(schedule?.start_time ?? "08:00");
      setEndTime(schedule?.end_time ?? "10:00");
      setRoom(schedule?.room ?? "");
      setSelAcademicYearId(schedule?.academic_year_id ?? academicYearId ?? "");
      setErrors({});
    }
  }, [open, schedule, classId, academicYearId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selClassId) e.classId = "La classe est requise";
    if (!subjectId) e.subjectId = "La matiere est requise";
    if (!startTime) e.startTime = "Heure de debut requise";
    if (!endTime) e.endTime = "Heure de fin requise";
    if (startTime && endTime && endTime <= startTime) e.endTime = "La fin doit etre apres le debut";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) return;

    const ayId = selAcademicYearId || academicYearId || schedule?.academic_year_id;
    if (!ayId) {
      toast({ title: "Erreur", description: "Annee academique requise.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        institution_id: profile.institution_id,
        class_id: selClassId,
        subject_id: subjectId,
        teacher_id: teacherId === "none" ? null : teacherId,
        academic_year_id: ayId,
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        room: room.trim() || null,
      };

      if (schedule) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", schedule.id);
        if (error) throw error;
        toast({ title: "Seance modifiee" });
      } else {
        const { error } = await supabase.from("schedules").insert(payload);
        if (error) throw error;
        toast({ title: "Seance creee" });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{schedule ? "Modifier la seance" : "Nouvelle seance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sched-class">Classe *</Label>
            <Select value={selClassId} onValueChange={setSelClassId} disabled={loading || !!classId}>
              <SelectTrigger id="sched-class"><SelectValue placeholder="Selectionner une classe" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-subject">Matiere *</Label>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={loading || !selClassId}>
                <SelectTrigger id="sched-subject"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-teacher">Formateur</Label>
              <Select value={teacherId} onValueChange={setTeacherId} disabled={loading}>
                <SelectTrigger id="sched-teacher"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.teacher_number}{t.specialization ? ` - ${t.specialization}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-day">Jour *</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={loading}>
                <SelectTrigger id="sched-day"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-start">Debut *</Label>
              <Input id="sched-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={loading} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-end">Fin *</Label>
              <Input id="sched-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={loading} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-room">Salle</Label>
            <Input id="sched-room" value={room} onChange={(e) => setRoom(e.target.value)} disabled={loading} placeholder="Salle 101" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {schedule ? "Enregistrer" : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DAY_OPTIONS };
