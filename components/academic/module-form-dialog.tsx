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
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Module = Database["public"]["Tables"]["modules"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module?: Module | null;
  programId: string;
  onSaved?: () => void;
}

export function ModuleFormDialog({ open, onOpenChange, module, programId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [semester, setSemester] = useState("1");
  const [orderIndex, setOrderIndex] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(module?.name ?? "");
      setCode(module?.code ?? "");
      setSemester(String(module?.semester ?? "1"));
      setOrderIndex(String(module?.order_index ?? "0"));
      setErrors({});
    }
  }, [open, module]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Le nom est requis";
    if (!code.trim()) e.code = "Le code est requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (module) {
        const { error } = await supabase
          .from("modules")
          .update({ name: name.trim(), code: code.trim(), semester: parseInt(semester), order_index: parseInt(orderIndex) })
          .eq("id", module.id);
        if (error) throw error;
        toast({ title: "Module modifié" });
      } else {
        const { error } = await supabase.from("modules").insert({
          program_id: programId,
          name: name.trim(), code: code.trim(),
          semester: parseInt(semester), order_index: parseInt(orderIndex),
        });
        if (error) throw error;
        toast({ title: "Module créé" });
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
          <DialogTitle>{module ? "Modifier le module" : "Nouveau module"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mod-name">Nom *</Label>
              <Input id="mod-name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mod-code">Code *</Label>
              <Input id="mod-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={loading} />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mod-semester">Semestre</Label>
              <Select value={semester} onValueChange={setSemester} disabled={loading}>
                <SelectTrigger id="mod-semester"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semestre 1</SelectItem>
                  <SelectItem value="2">Semestre 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mod-order">Ordre</Label>
              <Input id="mod-order" type="number" min="0" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} disabled={loading} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {module ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
