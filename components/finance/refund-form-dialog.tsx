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
import { Textarea } from "@/components/ui/textarea";
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
import { PAYMENT_METHOD_OPTIONS } from "@/components/shared/status-badge";
import type { Database } from "@/lib/types/database";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

interface RefundFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSaved?: () => void;
}

export function RefundFormDialog({ open, onOpenChange, payment, onSaved }: RefundFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && payment) {
      setAmount(String(payment.amount));
      setReason("");
      setMethod(payment.method);
      setErrors({});
    }
  }, [open, payment]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!amount || Number(amount) <= 0) e.amount = "Le montant doit être positif";
    if (payment && Number(amount) > payment.amount) e.amount = `Le montant ne peut pas dépasser le paiement (${payment.amount})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!payment || !profile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("refunds").insert({
        payment_id: payment.id,
        student_id: payment.student_id,
        amount: Number(amount),
        reason: reason.trim() || null,
        method,
        status: "completed",
        processed_by: profile.id,
      });

      if (error) throw error;

      toast({ title: "Remboursement enregistré", description: `${Number(amount).toLocaleString("fr-FR")} remboursé.` });
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
          <DialogTitle>Rembourser un paiement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paiement initial :</span>
              <span className="font-medium">{Number(payment?.amount ?? 0).toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date :</span>
              <span className="font-medium">{payment ? new Date(payment.payment_date).toLocaleDateString("fr-FR") : "—"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund_amount">Montant du remboursement *</Label>
            <Input
              id="refund_amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              placeholder="0.00"
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund_method">Méthode de remboursement</Label>
            <Select value={method} onValueChange={setMethod} disabled={loading}>
              <SelectTrigger id="refund_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund_reason">Motif (optionnel)</Label>
            <Textarea
              id="refund_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="Raison du remboursement..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rembourser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
