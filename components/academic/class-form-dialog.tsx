"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classItem?: ClassRow | null;
  courseId?: string;
  academicYearId?: string;
  onSaved?: () => void;
}

export function ClassFormDialog({ open, onOpenChange, classItem, courseId, academicYearId, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [room, setRoom] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(classItem?.name ?? "");
      setCapacity(String(classItem?.capacity ?? "30"));
      setRoom(classItem?.room ?? "");
      setErrors({});
    }
  }, [open, classItem]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    const c = parseInt(capacity);
    if (!c || c <= 0) e.capacity = "La capacité doit être > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) return;

    setLoading(true);
    try {
      if (classItem) {
        const { error } = await supabase
          .from("classes")
          .update({ name: name.trim(), capacity: parseInt(capacity), room: room.trim() || null })
          .eq("id", classItem.id);
        if (error) throw error;
        toast({ title: "Classe modifiée" });
      } else {
        if (!courseId || !academicYearId) {
          toast({ title: "Erreur", description: "Cours et année académique requis.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { error } = await supabase.from("classes").insert({
          institution_id: profile.institution_id,
          course_id: courseId,
          academic_year_id: academicYearId,
          name: name.trim(),
          capacity: parseInt(capacity),
          room: room.trim() || null,
        });
        if (error) throw error;
        toast({ title: "Classe créée" });
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{classItem ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-name">Nom / Code *</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="BTS-R1-A" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-capacity">Capacité *</Label>
              <Input id="class-capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={loading} />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-room">Salle</Label>
              <Input id="class-room" value={room} onChange={(e) => setRoom(e.target.value)} disabled={loading} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {classItem ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
