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
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Subject = Database["public"]["Tables"]["subjects"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: Subject | null;
  moduleId: string;
  onSaved?: () => void;
}

export function SubjectFormDialog({ open, onOpenChange, subject, moduleId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hoursPlanned, setHoursPlanned] = useState("0");
  const [coefficient, setCoefficient] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(subject?.name ?? "");
      setCode(subject?.code ?? "");
      setHoursPlanned(String(subject?.hours_planned ?? "0"));
      setCoefficient(String(subject?.coefficient ?? "1"));
      setErrors({});
    }
  }, [open, subject]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!code.trim()) e.code = "Le code est requis";
    const h = parseInt(hoursPlanned);
    if (isNaN(h) || h < 0) e.hoursPlanned = "Les heures doivent être >= 0";
    const c = parseFloat(coefficient);
    if (isNaN(c) || c <= 0) e.coefficient = "Le coefficient doit être > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (subject) {
        const { error } = await supabase
          .from("subjects")
          .update({ name: name.trim(), code: code.trim(), hours_planned: parseInt(hoursPlanned), coefficient: parseFloat(coefficient) })
          .eq("id", subject.id);
        if (error) throw error;
        toast({ title: "Matière modifiée" });
      } else {
        const { error } = await supabase.from("subjects").insert({
          module_id: moduleId,
          name: name.trim(), code: code.trim(),
          hours_planned: parseInt(hoursPlanned), coefficient: parseFloat(coefficient),
        });
        if (error) throw error;
        toast({ title: "Matière créée" });
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
          <DialogTitle>{subject ? "Modifier la matière" : "Nouvelle matière"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subj-name">Nom *</Label>
              <Input id="subj-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-code">Code *</Label>
              <Input id="subj-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={loading} />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subj-hours">Volume horaire (h)</Label>
              <Input id="subj-hours" type="number" min="0" value={hoursPlanned} onChange={(e) => setHoursPlanned(e.target.value)} disabled={loading} />
              {errors.hoursPlanned && <p className="text-xs text-destructive">{errors.hoursPlanned}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-coef">Coefficient</Label>
              <Input id="subj-coef" type="number" min="0.1" step="0.1" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} disabled={loading} />
              {errors.coefficient && <p className="text-xs text-destructive">{errors.coefficient}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {subject ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
