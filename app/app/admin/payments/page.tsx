"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import {
  PaymentPlanStatusBadge,
  InstallmentStatusBadge,
  PaymentStatusBadge,
  PAYMENT_PLAN_STATUS_OPTIONS,
} from "@/components/shared/status-badge";
import { PaymentPlanFormDialog } from "@/components/finance/payment-plan-form-dialog";
import { PaymentFormDialog } from "@/components/finance/payment-form-dialog";
import { RefundFormDialog } from "@/components/finance/refund-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  Plus, Search, MoreHorizontal, Eye, Pencil, Wallet, Banknote,
  Receipt, TrendingDown, ChevronLeft, ChevronRight, RotateCcw,
  Calendar, CheckCircle2, Clock,
} from "lucide-react";

type PaymentPlan = Database["public"]["Tables"]["payment_plans"]["Row"];
type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

type PlanWithRelations = PaymentPlan & {
  students?: { student_number: string; profile_id: string | null };
  courses?: { name: string };
  academic_years?: { name: string };
};

type InstallmentWithPlan = Installment & {
  payment_plans?: {
    id: string; student_id: string; course_id: string; academic_year_id: string;
    total_amount: number; status: string;
    students?: { student_number: string };
    courses?: { name: string };
  };
};

type PaymentWithRelations = Payment & {
  installments?: { label: string; payment_plan_id: string };
  students?: { student_number: string };
};

const PAGE_SIZE = 10;

function formatMoney(amount: number, currency: string) {
  return `${Number(amount).toLocaleString("fr-FR")} ${currency === "EUR" ? "€" : "FCFA"}`;
}

export default function PaymentsPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [plans, setPlans] = useState<PlanWithRelations[]>([]);
  const [installments, setInstallments] = useState<InstallmentWithPlan[]>([]);
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<Installment | null>(null);
  const [paymentStudentId, setPaymentStudentId] = useState("");
  const [paymentAcademicYearId, setPaymentAcademicYearId] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<PlanWithRelations | null>(null);
  const [detailInstallments, setDetailInstallments] = useState<Installment[]>([]);
  const [detailPayments, setDetailPayments] = useState<Payment[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  const [stats, setStats] = useState({ totalCollected: 0, totalOutstanding: 0, totalOverdue: 0, planCount: 0 });

  const canCreate = permissions.includes("payments.create" as never);
  const canUpdate = permissions.includes("payments.update" as never);
  const canRefund = permissions.includes("refunds.create" as never);

  const fetchPlans = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("payment_plans")
        .select("*, students(student_number, profile_id), courses(name), academic_years(name)", { count: "exact" })
        .eq("institution_id", profile.institution_id);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search.trim()) {
        query = query.or(`students.student_number.ilike.%${search.trim()}%`);
      }
      query = query.order("created_at", { ascending: false });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;
      setPlans(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, search, page]);

  const fetchStats = useCallback(async () => {
    if (!profile?.institution_id) return;
    try {
      const { data: allPlans } = await supabase
        .from("payment_plans")
        .select("id, total_amount, status")
        .eq("institution_id", profile.institution_id);

      const { data: allInstallments } = await supabase
        .from("installments")
        .select("amount_due, amount_paid, status")
        .in("payment_plan_id",
          (allPlans ?? []).map((p: { id: string }) => p.id));

      const totalCollected = (allInstallments ?? []).reduce((s, i) => s + Number(i.amount_paid), 0);
      const totalOutstanding = (allInstallments ?? []).reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
      const totalOverdue = (allInstallments ?? []).filter(i => i.status === "overdue").reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);

      setStats({
        totalCollected,
        totalOutstanding,
        totalOverdue,
        planCount: allPlans?.length ?? 0,
      });
    } catch { /* ignore */ }
  }, [profile?.institution_id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openDetail = async (plan: PlanWithRelations) => {
    setDetailPlan(plan);
    const { data: insts } = await supabase
      .from("installments")
      .select("*")
      .eq("payment_plan_id", plan.id)
      .order("installment_number", { ascending: true });
    setDetailInstallments(insts ?? []);

    const installmentIds = (insts ?? []).map(i => i.id);
    if (installmentIds.length > 0) {
      const { data: pays } = await supabase
        .from("payments")
        .select("*")
        .in("installment_id", installmentIds)
        .order("payment_date", { ascending: false });
      setDetailPayments(pays ?? []);
    } else {
      setDetailPayments([]);
    }
    setDetailOpen(true);
  };

  const handlePayment = (installment: Installment, plan: PlanWithRelations) => {
    setPaymentInstallment(installment);
    setPaymentStudentId(plan.student_id);
    setPaymentAcademicYearId(plan.academic_year_id);
    setPaymentOpen(true);
  };

  const handleRefund = (payment: Payment) => {
    setRefundPayment(payment);
    setRefundOpen(true);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && plans.length === 0) {
    return (
      <div>
        <PageHeader title="Paiements" description="Gestion des échéanciers, paiements et remboursements" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Paiements" description="Gestion des échéanciers, paiements et remboursements" />
        <ErrorState message={error} action={<Button variant="outline" size="sm" onClick={fetchPlans}>Réessayer</Button>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Paiements"
        description="Gestion des échéanciers, paiements et remboursements"
        action={canCreate && (
          <Button onClick={() => { setEditingPlan(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel échéancier
          </Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total encaissé" value={formatMoney(stats.totalCollected, "XOF")} icon={Banknote} color="text-green-600" />
        <StatCard label="Solde restant" value={formatMoney(stats.totalOutstanding, "XOF")} icon={Clock} color="text-orange-600" />
        <StatCard label="En retard" value={formatMoney(stats.totalOverdue, "XOF")} icon={TrendingDown} color="text-red-600" />
        <StatCard label="Échéanciers" value={stats.planCount} icon={Wallet} color="text-primary" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par matricule..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {PAYMENT_PLAN_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            title="Aucun échéancier"
            message="Créez un échéancier pour suivre les paiements d'un étudiant."
            action={canCreate && (
              <Button onClick={() => { setEditingPlan(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Créer un échéancier
              </Button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Étudiant</TableHead>
                    <TableHead>Formation</TableHead>
                    <TableHead>Année</TableHead>
                    <TableHead>Montant total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(p)}>
                      <TableCell className="font-medium">{p.students?.student_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.courses?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.academic_years?.name ?? "—"}</TableCell>
                      <TableCell className="font-medium">{formatMoney(p.total_amount, p.currency)}</TableCell>
                      <TableCell><PaymentPlanStatusBadge status={p.status} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(p)}>
                              <Eye className="w-4 h-4 mr-2" /> Voir le détail
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => { setEditingPlan(p); setFormOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Modifier
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{totalCount} échéancier{totalCount > 1 ? "s" : ""} au total</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <PaymentPlanFormDialog open={formOpen} onOpenChange={setFormOpen} paymentPlan={editingPlan} onSaved={() => { fetchPlans(); fetchStats(); }} />
      <PaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        installment={paymentInstallment}
        studentId={paymentStudentId}
        academicYearId={paymentAcademicYearId}
        onSaved={() => { fetchPlans(); fetchStats(); if (detailPlan) openDetail(detailPlan); }}
      />
      <RefundFormDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        payment={refundPayment}
        onSaved={() => { fetchPlans(); fetchStats(); if (detailPlan) openDetail(detailPlan); }}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail de l'échéancier</DialogTitle>
          </DialogHeader>
          {detailPlan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-xs text-muted-foreground">Étudiant</p>
                  <p className="text-sm font-medium">{detailPlan.students?.student_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Formation</p>
                  <p className="text-sm font-medium">{detailPlan.courses?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Année académique</p>
                  <p className="text-sm font-medium">{detailPlan.academic_years?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Montant total</p>
                  <p className="text-sm font-bold text-primary">{formatMoney(detailPlan.total_amount, detailPlan.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <PaymentPlanStatusBadge status={detailPlan.status} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Tranches</h4>
                <div className="space-y-2">
                  {detailInstallments.map((inst) => {
                    const remaining = Number(inst.amount_due) - Number(inst.amount_paid);
                    return (
                      <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{inst.label}</span>
                            <InstallmentStatusBadge status={inst.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dû : {formatMoney(inst.amount_due, "XOF")} · Payé : {formatMoney(inst.amount_paid, "XOF")} · Reste : {formatMoney(remaining, "XOF")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Échéance : {new Date(inst.due_date).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        {canCreate && remaining > 0 && inst.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => handlePayment(inst, detailPlan)}>
                            <Banknote className="w-4 h-4 mr-1" /> Payer
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Historique des paiements</h4>
                {detailPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement enregistré.</p>
                ) : (
                  <div className="space-y-2">
                    {detailPayments.map((pay) => (
                      <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <PaymentStatusBadge status={pay.status} />
                            <span className="text-sm font-medium">{formatMoney(pay.amount, "XOF")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(pay.payment_date).toLocaleDateString("fr-FR")} · {pay.method}
                          </p>
                          {pay.note && <p className="text-xs text-muted-foreground">Note : {pay.note}</p>}
                        </div>
                        {canRefund && pay.status === "completed" && (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRefund(pay)}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Rembourser
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
