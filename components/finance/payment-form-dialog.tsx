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

type Installment = Database["public"]["Tables"]["installments"]["Row"];

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment | null;
  studentId: string;
  academicYearId: string;
  onSaved?: () => void;
}

export function PaymentFormDialog({ open, onOpenChange, installment, studentId, academicYearId, onSaved }: PaymentFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && installment) {
      const remaining = Number(installment.amount_due) - Number(installment.amount_paid);
      setAmount(String(remaining > 0 ? remaining : 0));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setMethod("cash");
      setNote("");
      setErrors({});
    }
  }, [open, installment]);

  const remaining = installment ? Number(installment.amount_due) - Number(installment.amount_paid) : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!amount || Number(amount) <= 0) e.amount = "Le montant doit être positif";
    if (Number(amount) > remaining + 0.01) e.amount = `Le montant ne peut pas dépasser le solde restant (${remaining})`;
    if (!paymentDate) e.paymentDate = "La date est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!installment || !profile?.id) return;

    setLoading(true);
    try {
      const { data: payment, error: payError } = await supabase
        .from("payments")
        .insert({
          installment_id: installment.id,
          student_id: studentId,
          academic_year_id: academicYearId,
          amount: Number(amount),
          payment_date: paymentDate,
          method,
          status: "completed",
          collected_by: profile.id,
          note: note.trim() || null,
        })
        .select()
        .single();

      if (payError) throw payError;

      await supabase.from("payment_transactions").insert({
        payment_id: payment.id,
        provider: "manual",
        amount: Number(amount),
        currency: "XOF",
        signature_verified: true,
      });

      toast({ title: "Paiement enregistré", description: `${Number(amount).toLocaleString("fr-FR")} ${method === "cash" ? "espèces" : method}` });
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
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tranche :</span>
              <span className="font-medium">{installment?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant dû :</span>
              <span className="font-medium">{Number(installment?.amount_due ?? 0).toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Déjà payé :</span>
              <span className="font-medium">{Number(installment?.amount_paid ?? 0).toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">Reste à payer :</span>
              <span className="font-bold text-primary">{remaining.toLocaleString("fr-FR")}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Montant du paiement *</Label>
            <Input
              id="amount"
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
            <Label htmlFor="payment_date">Date du paiement *</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={loading}
            />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">Méthode de paiement</Label>
            <Select value={method} onValueChange={setMethod} disabled={loading}>
              <SelectTrigger id="method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optionnel)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              placeholder="Note interne..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
