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
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Term = Database["public"]["Tables"]["terms"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term?: Term | null;
  academicYears: AcademicYear[];
  defaultYearId?: string;
  onSaved?: () => void;
}

export function TermFormDialog({ open, onOpenChange, term, academicYears, defaultYearId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(term?.name ?? "");
      setAcademicYearId(term?.academic_year_id ?? defaultYearId ?? "");
      setStartDate(term?.start_date ?? "");
      setEndDate(term?.end_date ?? "");
      setErrors({});
    }
  }, [open, term, defaultYearId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!academicYearId) e.academicYearId = "L'année académique est requise";
    if (!startDate) e.startDate = "La date de début est requise";
    if (!endDate) e.endDate = "La date de fin est requise";
    if (startDate && endDate && endDate <= startDate) e.endDate = "La date de fin doit être après le début";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (term) {
        const { error } = await supabase
          .from("terms")
          .update({ name: name.trim(), academic_year_id: academicYearId, start_date: startDate, end_date: endDate })
          .eq("id", term.id);
        if (error) throw error;
        toast({ title: "Période modifiée" });
      } else {
        const { error } = await supabase.from("terms").insert({
          academic_year_id: academicYearId,
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
        });
        if (error) throw error;
        toast({ title: "Période créée" });
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
          <DialogTitle>{term ? "Modifier la période" : "Nouvelle période"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="term-name">Nom *</Label>
            <Input id="term-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} placeholder="Semestre 1" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-ay">Année académique *</Label>
            <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={loading}>
              <SelectTrigger id="term-ay"><SelectValue placeholder="Sélectionner une année" /></SelectTrigger>
              <SelectContent>
                {academicYears.map((ay) => (
                  <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.academicYearId && <p className="text-xs text-destructive">{errors.academicYearId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="term-start">Date de début *</Label>
              <Input id="term-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-end">Date de fin *</Label>
              <Input id="term-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {term ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
