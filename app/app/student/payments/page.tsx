"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wallet, Clock, CircleCheck as CheckCircle } from "lucide-react";

function formatMoney(amount: number) {
  return `${Number(amount).toLocaleString("fr-FR")} FCFA`;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  paid: { label: "Payé", variant: "default" },
  partial: { label: "Partiel", variant: "secondary" },
  overdue: { label: "En retard", variant: "destructive" },
};

export default function StudentPaymentsPage() {
  const { paymentPlans, installments, payments, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes paiements" /><LoadingState /></div>;
  }

  const totalDue = paymentPlans.reduce((s, p) => s + Number(p.total_amount), 0);
  const totalPaid = paymentPlans.reduce((s, p) => {
    const insts = installments[p.id] ?? [];
    return s + insts.reduce((si, i) => si + Number(i.amount_paid), 0);
  }, 0);
  const progress = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

  return (
    <div>
      <PageHeader title="Mes paiements" description="Mon échéancier et historique" />

      {paymentPlans.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucun échéancier" message="Aucun plan de paiement n'a été créé pour votre compte." /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-primary" /><span className="text-sm text-muted-foreground">Total à payer</span></div>
              <p className="text-xl font-bold">{formatMoney(totalDue)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm text-muted-foreground">Payé</span></div>
              <p className="text-xl font-bold text-green-600">{formatMoney(totalPaid)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-orange-600" /><span className="text-sm text-muted-foreground">Restant</span></div>
              <p className="text-xl font-bold text-orange-600">{formatMoney(totalDue - totalPaid)}</p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progression</span>
              <span className="text-sm text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} />
          </Card>

          {paymentPlans.map((plan) => {
            const insts = installments[plan.id] ?? [];
            const pays = payments[plan.id] ?? [];
            return (
              <Card key={plan.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{plan.courses?.name ?? "Formation"}</p>
                    <p className="text-xs text-muted-foreground">{plan.academic_years?.name ?? "—"}</p>
                  </div>
                  <Badge variant={STATUS_CONFIG[plan.status]?.variant ?? "outline"}>
                    {STATUS_CONFIG[plan.status]?.label ?? plan.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {insts.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">Échéance {inst.installment_number}</p>
                        <p className="text-xs text-muted-foreground">Échéance : {new Date(inst.due_date).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatMoney(Number(inst.amount_paid))} / {formatMoney(Number(inst.amount_due))}</p>
                        <Badge variant={STATUS_CONFIG[inst.status]?.variant ?? "outline"} className="text-xs">
                          {STATUS_CONFIG[inst.status]?.label ?? inst.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {pays.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Historique des paiements</p>
                    {pays.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-1">
                        <span>{new Date(p.payment_date).toLocaleDateString("fr-FR")}</span>
                        <span className="font-medium text-green-600">{formatMoney(Number(p.amount))}</span>
                        <Badge variant="outline" className="text-xs">{p.method}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
