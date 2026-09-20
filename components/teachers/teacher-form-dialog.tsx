"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { TEACHER_STATUS_OPTIONS } from "@/components/shared/status-badge";
import type { Database } from "@/lib/types/database";

type Teacher = Database["public"]["Tables"]["teachers"]["Row"];

interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher?: Teacher | null;
  onSaved?: () => void;
}

export function TeacherFormDialog({ open, onOpenChange, teacher, onSaved }: TeacherFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teacherNumber, setTeacherNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [status, setStatus] = useState("active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTeacherNumber(teacher?.teacher_number ?? "");
      setSpecialization(teacher?.specialization ?? "");
      setStatus(teacher?.status ?? "active");
      setErrors({});
    }
  }, [open, teacher]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!teacherNumber.trim()) e.teacherNumber = "Le numéro de formateur est requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) {
      toast({ title: "Erreur", description: "Aucune institution associée à votre compte.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (teacher) {
        const { error } = await supabase
          .from("teachers")
          .update({
            teacher_number: teacherNumber.trim(),
            specialization: specialization.trim() || null,
            status,
          })
          .eq("id", teacher.id);

        if (error) throw error;
        toast({ title: "Formateur modifié", description: "Les informations ont été mises à jour." });
      } else {
        const { error } = await supabase.from("teachers").insert({
          institution_id: profile.institution_id,
          teacher_number: teacherNumber.trim(),
          specialization: specialization.trim() || null,
          status,
        });

        if (error) throw error;
        toast({ title: "Formateur créé", description: "Le formateur a été enregistré." });
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{teacher ? "Modifier le formateur" : "Nouveau formateur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teacher_number">Numéro de formateur *</Label>
            <Input
              id="teacher_number"
              value={teacherNumber}
              onChange={(e) => setTeacherNumber(e.target.value)}
              disabled={loading}
              placeholder="ENS-0001"
            />
            {errors.teacherNumber && <p className="text-xs text-destructive">{errors.teacherNumber}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialization">Spécialisation</Label>
            <Input
              id="specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              disabled={loading}
              placeholder="Mathématiques"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <Select value={status} onValueChange={setStatus} disabled={loading}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEACHER_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {teacher ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
