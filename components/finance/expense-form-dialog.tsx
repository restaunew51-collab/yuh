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
import { EXPENSE_CATEGORY_OPTIONS } from "@/components/shared/status-badge";
import type { Database } from "@/lib/types/database";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSaved?: () => void;
}

export function ExpenseFormDialog({ open, onOpenChange, expense, onSaved }: ExpenseFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("autres");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [expenseDate, setExpenseDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCategory(expense?.category ?? "autres");
      setDescription(expense?.description ?? "");
      setAmount(expense ? String(expense.amount) : "");
      setCurrency(expense?.currency ?? "XOF");
      setExpenseDate(expense?.expense_date ?? new Date().toISOString().split("T")[0]);
      setErrors({});
    }
  }, [open, expense]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!category) e.category = "La catégorie est requise";
    if (!amount || Number(amount) <= 0) e.amount = "Le montant doit être positif";
    if (!expenseDate) e.expenseDate = "La date est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id || !profile?.id) return;

    setLoading(true);
    try {
      if (expense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            category,
            description: description.trim() || null,
            amount: Number(amount),
            currency,
            expense_date: expenseDate,
          })
          .eq("id", expense.id);

        if (error) throw error;
        toast({ title: "Dépense modifiée", description: "Les modifications ont été enregistrées." });
      } else {
        const { error } = await supabase.from("expenses").insert({
          institution_id: profile.institution_id,
          category,
          description: description.trim() || null,
          amount: Number(amount),
          currency,
          expense_date: expenseDate,
          created_by: profile.id,
        });

        if (error) throw error;
        toast({ title: "Dépense enregistrée", description: "La dépense a été ajoutée." });
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
          <DialogTitle>{expense ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Select value={category} onValueChange={setCategory} disabled={loading}>
              <SelectTrigger id="category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant *</Label>
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
              <Label htmlFor="currency">Devise</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={loading}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XOF">XOF (CFA)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense_date">Date *</Label>
            <Input
              id="expense_date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              disabled={loading}
            />
            {errors.expenseDate && <p className="text-xs text-destructive">{errors.expenseDate}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="Détails de la dépense..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {expense ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
