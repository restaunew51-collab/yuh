"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Program = Database["public"]["Tables"]["programs"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: Program | null;
  onSaved?: () => void;
}

export function ProgramFormDialog({ open, onOpenChange, program, onSaved }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [durationYears, setDurationYears] = useState("1");
  const [admissionRequirements, setAdmissionRequirements] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setCode(program?.code ?? "");
      setDescription(program?.description ?? "");
      setDurationYears(String(program?.duration_years ?? "1"));
      setAdmissionRequirements(program?.admission_requirements ?? "");
      setIsActive(program?.is_active ?? true);
      setErrors({});
    }
  }, [open, program]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!code.trim()) e.code = "Le code est requis";
    const dy = parseInt(durationYears);
    if (!dy || dy <= 0) e.durationYears = "La durée doit être supérieure à 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) return;

    setLoading(true);
    try {
      if (program) {
        const { error } = await supabase
          .from("programs")
          .update({
            name: name.trim(), code: code.trim(), description: description.trim() || null,
            duration_years: parseInt(durationYears), admission_requirements: admissionRequirements.trim() || null,
            is_active: isActive,
          })
          .eq("id", program.id);
        if (error) throw error;
        toast({ title: "Formation modifiée" });
      } else {
        const { error } = await supabase.from("programs").insert({
          institution_id: profile.institution_id,
          name: name.trim(), code: code.trim(), description: description.trim() || null,
          duration_years: parseInt(durationYears), admission_requirements: admissionRequirements.trim() || null,
          is_active: isActive,
        });
        if (error) throw error;
        toast({ title: "Formation créée" });
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
          <DialogTitle>{program ? "Modifier la formation" : "Nouvelle formation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prog-name">Nom *</Label>
              <Input id="prog-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="prog-code">Code *</Label>
              <Input id="prog-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={loading} placeholder="LINFO" />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prog-desc">Description</Label>
            <Textarea id="prog-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prog-duration">Durée (années) *</Label>
              <Input id="prog-duration" type="number" min="1" value={durationYears} onChange={(e) => setDurationYears(e.target.value)} disabled={loading} />
              {errors.durationYears && <p className="text-xs text-destructive">{errors.durationYears}</p>}
            </div>
            <div className="flex items-end">
              <div className="flex items-center justify-between w-full">
                <Label htmlFor="prog-active">Formation active</Label>
                <Switch id="prog-active" checked={isActive} onCheckedChange={setIsActive} disabled={loading} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prog-req">Prérequis d'admission</Label>
            <Textarea id="prog-req" value={admissionRequirements} onChange={(e) => setAdmissionRequirements(e.target.value)} disabled={loading} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {program ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
