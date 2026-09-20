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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYear?: AcademicYear | null;
  onSaved?: () => void;
}

export function AcademicYearFormDialog({ open, onOpenChange, academicYear, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(academicYear?.name ?? "");
      setStartDate(academicYear?.start_date ?? "");
      setEndDate(academicYear?.end_date ?? "");
      setIsActive(academicYear?.is_active ?? true);
      setErrors({});
    }
  }, [open, academicYear]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!startDate) e.startDate = "La date de début est requise";
    if (!endDate) e.endDate = "La date de fin est requise";
    if (startDate && endDate && endDate <= startDate) e.endDate = "La date de fin doit être après le début";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) return;

    setLoading(true);
    try {
      if (academicYear) {
        const { error } = await supabase
          .from("academic_years")
          .update({ name: name.trim(), start_date: startDate, end_date: endDate, is_active: isActive })
          .eq("id", academicYear.id);
        if (error) throw error;
        toast({ title: "Année académique modifiée" });
      } else {
        const { error } = await supabase.from("academic_years").insert({
          institution_id: profile.institution_id,
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          is_active: isActive,
        });
        if (error) throw error;
        toast({ title: "Année académique créée" });
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
          <DialogTitle>{academicYear ? "Modifier l'année académique" : "Nouvelle année académique"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ay-name">Nom *</Label>
            <Input id="ay-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="2026-2027" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ay-start">Date de début *</Label>
              <Input id="ay-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ay-end">Date de fin *</Label>
              <Input id="ay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ay-active">Année active</Label>
            <Switch id="ay-active" checked={isActive} onCheckedChange={setIsActive} disabled={loading} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {academicYear ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
