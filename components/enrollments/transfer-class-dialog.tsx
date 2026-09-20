"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  currentClassId: string;
  courseId: string;
  studentName: string;
  currentClassName: string;
  onTransferred?: () => void;
}

export function TransferClassDialog({
  open, onOpenChange, enrollmentId, currentClassId, courseId, studentName, currentClassName, onTransferred,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [toClassId, setToClassId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && courseId) {
      supabase
        .from("classes")
        .select("*")
        .eq("course_id", courseId)
        .neq("id", currentClassId)
        .order("name")
        .then(({ data }) => setClasses(data ?? []));
    }
    setToClassId("");
    setReason("");
    setError(null);
  }, [open, courseId, currentClassId]);

  const handleTransfer = async () => {
    if (!toClassId) {
      setError("Veuillez sélectionner une classe de destination.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("perform_class_transfer", {
        p_enrollment_id: enrollmentId,
        p_to_class_id: toClassId,
        p_reason: reason.trim() || null,
      });

      if (rpcError) throw rpcError;

      toast({ title: "Transfert réussi", description: `${studentName} a été transféré vers la nouvelle classe.` });
      onTransferred?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Transférer vers une autre classe</DialogTitle>
              <DialogDescription>
                {studentName} — Classe actuelle : {currentClassName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="transfer-class">Classe de destination *</Label>
            <Select value={toClassId} onValueChange={setToClassId} disabled={loading}>
              <SelectTrigger id="transfer-class"><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} (cap. {c.capacity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classes.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucune autre classe disponible pour ce cours.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-reason">Motif du transfert</Label>
            <Textarea id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={loading} rows={2} placeholder="Changement de groupe..." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button type="button" onClick={handleTransfer} disabled={loading || !toClassId}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmer le transfert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
