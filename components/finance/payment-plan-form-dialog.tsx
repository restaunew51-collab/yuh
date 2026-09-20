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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type PaymentPlan = Database["public"]["Tables"]["payment_plans"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type Course = Database["public"]["Tables"]["courses"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

interface InstallmentDraft {
  label: string;
  amount: string;
  due_date: string;
}

interface PaymentPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentPlan?: PaymentPlan | null;
  onSaved?: () => void;
}

export function PaymentPlanFormDialog({ open, onOpenChange, paymentPlan, onSaved }: PaymentPlanFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<{ id: string; student_number: string; profile_id: string | null }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installments, setInstallments] = useState<InstallmentDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !profile?.institution_id) return;
    supabase
      .from("students")
      .select("id, student_number, profile_id")
      .eq("institution_id", profile.institution_id)
      .order("student_number", { ascending: true })
      .then(({ data }) => setStudents(data ?? []));
    supabase
      .from("courses")
      .select("id, name")
      .eq("institution_id", profile.institution_id)
      .order("name", { ascending: true })
      .then(({ data }) => setCourses(data ?? []));
    supabase
      .from("academic_years")
      .select("id, name")
      .eq("institution_id", profile.institution_id)
      .order("start_date", { ascending: false })
      .then(({ data }) => setAcademicYears(data ?? []));
  }, [open, profile?.institution_id]);

  useEffect(() => {
    if (open && paymentPlan) {
      setStudentId(paymentPlan.student_id);
      setCourseId(paymentPlan.course_id);
      setAcademicYearId(paymentPlan.academic_year_id);
      setTotalAmount(String(paymentPlan.total_amount));
      setCurrency(paymentPlan.currency);
      if (paymentPlan) {
        supabase
          .from("installments")
          .select("label, amount_due, due_date")
          .eq("payment_plan_id", paymentPlan.id)
          .order("installment_number", { ascending: true })
          .then(({ data }) => {
            if (data && data.length > 0) {
              setInstallments(data.map((d) => ({
                label: d.label,
                amount: String(d.amount_due),
                due_date: d.due_date,
              })));
              setInstallmentCount(data.length);
            } else {
              setInstallments([{ label: "Tranche 1", amount: String(paymentPlan.total_amount), due_date: new Date().toISOString().split("T")[0] }]);
              setInstallmentCount(1);
            }
          });
      }
    } else if (open && !paymentPlan) {
      setStudentId("");
      setCourseId("");
      setAcademicYearId("");
      setTotalAmount("");
      setCurrency("XOF");
      setInstallmentCount(1);
      setInstallments([{ label: "Tranche 1", amount: "", due_date: new Date().toISOString().split("T")[0] }]);
      setErrors({});
    }
  }, [open, paymentPlan]);

  useEffect(() => {
    if (!open) return;
    const count = Math.max(1, installmentCount);
    const next = Array.from({ length: count }, (_, i) =>
      installments[i] ?? { label: `Tranche ${i + 1}`, amount: "", due_date: new Date().toISOString().split("T")[0] }
    );
    setInstallments(next);
  }, [installmentCount, open]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!studentId) e.studentId = "L'étudiant est requis";
    if (!courseId) e.courseId = "La formation est requise";
    if (!academicYearId) e.academicYearId = "L'année académique est requise";
    if (!totalAmount || Number(totalAmount) <= 0) e.totalAmount = "Le montant total doit être positif";
    const totalInstallments = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    if (Math.abs(totalInstallments - Number(totalAmount)) > 0.01) {
      e.installments = `Le total des tranches (${totalInstallments}) ne correspond pas au montant total (${totalAmount})`;
    }
    installments.forEach((inst, i) => {
      if (!inst.amount || Number(inst.amount) <= 0) e[`inst_${i}`] = "Montant requis";
      if (!inst.due_date) e[`due_${i}`] = "Date requise";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!profile?.institution_id) {
      toast({ title: "Erreur", description: "Aucune institution associée.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (paymentPlan) {
        const { error } = await supabase
          .from("payment_plans")
          .update({
            total_amount: Number(totalAmount),
            currency,
          })
          .eq("id", paymentPlan.id);
        if (error) throw error;

        const { data: existing } = await supabase
          .from("installments")
          .select("id")
          .eq("payment_plan_id", paymentPlan.id)
          .order("installment_number", { ascending: true });

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          if (existing && existing[i]) {
            await supabase
              .from("installments")
              .update({
                label: inst.label,
                amount_due: Number(inst.amount),
                due_date: inst.due_date,
              })
              .eq("id", existing[i].id);
          } else {
            await supabase.from("installments").insert({
              payment_plan_id: paymentPlan.id,
              student_id: studentId,
              academic_year_id: academicYearId,
              installment_number: i + 1,
              label: inst.label,
              amount_due: Number(inst.amount),
              due_date: inst.due_date,
            });
          }
        }

        toast({ title: "Échéancier modifié", description: "Les modifications ont été enregistrées." });
      } else {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", studentId)
          .eq("academic_year_id", academicYearId)
          .maybeSingle();

        const { data: plan, error: planError } = await supabase
          .from("payment_plans")
          .insert({
            institution_id: profile.institution_id,
            student_id: studentId,
            course_id: courseId,
            academic_year_id: academicYearId,
            enrollment_id: enrollment?.id ?? null,
            total_amount: Number(totalAmount),
            currency,
            status: "pending",
          })
          .select()
          .single();

        if (planError) throw planError;

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          await supabase.from("installments").insert({
            payment_plan_id: plan.id,
            student_id: studentId,
            academic_year_id: academicYearId,
            installment_number: i + 1,
            label: inst.label,
            amount_due: Number(inst.amount),
            due_date: inst.due_date,
          });
        }

        toast({ title: "Échéancier créé", description: "Le plan de paiement et les tranches ont été enregistrés." });
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{paymentPlan ? "Modifier l'échéancier" : "Nouvel échéancier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student">Étudiant *</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={loading || !!paymentPlan}>
                <SelectTrigger id="student"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.student_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.studentId && <p className="text-xs text-destructive">{errors.studentId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Formation *</Label>
              <Select value={courseId} onValueChange={setCourseId} disabled={loading || !!paymentPlan}>
                <SelectTrigger id="course"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.courseId && <p className="text-xs text-destructive">{errors.courseId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">Année académique *</Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={loading || !!paymentPlan}>
                <SelectTrigger id="academic_year"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => (
                    <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.academicYearId && <p className="text-xs text-destructive">{errors.academicYearId}</p>}
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
            <div className="space-y-2">
              <Label htmlFor="total_amount">Montant total *</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={loading}
                placeholder="0.00"
              />
              {errors.totalAmount && <p className="text-xs text-destructive">{errors.totalAmount}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment_count">Nombre de tranches</Label>
              <Input
                id="installment_count"
                type="number"
                min="1"
                max="12"
                value={installmentCount}
                onChange={(e) => setInstallmentCount(Number(e.target.value))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Tranches</Label>
            {errors.installments && <p className="text-xs text-destructive">{errors.installments}</p>}
            {installments.map((inst, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end p-3 rounded-lg border">
                <div className="space-y-1">
                  <Label className="text-xs">Libellé</Label>
                  <Input
                    value={inst.label}
                    onChange={(e) => {
                      const next = [...installments];
                      next[i] = { ...next[i], label: e.target.value };
                      setInstallments(next);
                    }}
                    disabled={loading}
                    placeholder={`Tranche ${i + 1}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Montant</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={inst.amount}
                    onChange={(e) => {
                      const next = [...installments];
                      next[i] = { ...next[i], amount: e.target.value };
                      setInstallments(next);
                    }}
                    disabled={loading}
                    placeholder="0.00"
                  />
                  {errors[`inst_${i}`] && <p className="text-xs text-destructive">{errors[`inst_${i}`]}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Échéance</Label>
                  <Input
                    type="date"
                    value={inst.due_date}
                    onChange={(e) => {
                      const next = [...installments];
                      next[i] = { ...next[i], due_date: e.target.value };
                      setInstallments(next);
                    }}
                    disabled={loading}
                  />
                  {errors[`due_${i}`] && <p className="text-xs text-destructive">{errors[`due_${i}`]}</p>}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {paymentPlan ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
