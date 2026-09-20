import { Badge } from "@/components/ui/badge";

const APPLICANT_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Nouvelle", variant: "default" },
  reviewing: { label: "En cours d'étude", variant: "secondary" },
  admitted: { label: "Acceptée", variant: "default" },
  rejected: { label: "Refusée", variant: "destructive" },
  waitlisted: { label: "Liste d'attente", variant: "outline" },
};

const STUDENT_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  graduated: { label: "Diplômé", variant: "secondary" },
  withdrawn: { label: "Retiré", variant: "outline" },
  suspended: { label: "Suspendu", variant: "destructive" },
  expelled: { label: "Exclu", variant: "destructive" },
};

const TEACHER_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  inactive: { label: "Inactif", variant: "outline" },
  on_leave: { label: "En congé", variant: "secondary" },
};

export function TeacherStatusBadge({ status }: { status: string }) {
  const config = TEACHER_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const TEACHER_STATUS_OPTIONS = Object.entries(TEACHER_STATUS_MAP).map(([value, { label }]) => ({
  value,
  label,
}));

export function ApplicantStatusBadge({ status }: { status: string }) {
  const config = APPLICANT_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function StudentStatusBadge({ status }: { status: string }) {
  const config = STUDENT_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const APPLICANT_STATUS_OPTIONS = Object.entries(APPLICANT_STATUS_MAP).map(([value, { label }]) => ({
  value,
  label,
}));

export const STUDENT_STATUS_OPTIONS = Object.entries(STUDENT_STATUS_MAP).map(([value, { label }]) => ({
  value,
  label,
}));

const PAYMENT_PLAN_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  partially_paid: { label: "Partiellement payé", variant: "secondary" },
  paid: { label: "Payé", variant: "default" },
  overdue: { label: "En retard", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};

const INSTALLMENT_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  partially_paid: { label: "Partiellement payé", variant: "secondary" },
  paid: { label: "Payé", variant: "default" },
  overdue: { label: "En retard", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  completed: { label: "Complété", variant: "default" },
  failed: { label: "Échoué", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};

const REFUND_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  completed: { label: "Complétée", variant: "default" },
  cancelled: { label: "Annulée", variant: "outline" },
};

export function PaymentPlanStatusBadge({ status }: { status: string }) {
  const config = PAYMENT_PLAN_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function InstallmentStatusBadge({ status }: { status: string }) {
  const config = INSTALLMENT_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const config = PAYMENT_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RefundStatusBadge({ status }: { status: string }) {
  const config = REFUND_STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const PAYMENT_PLAN_STATUS_OPTIONS = Object.entries(PAYMENT_PLAN_STATUS_MAP).map(([value, { label }]) => ({ value, label }));
export const INSTALLMENT_STATUS_OPTIONS = Object.entries(INSTALLMENT_STATUS_MAP).map(([value, { label }]) => ({ value, label }));
export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_MAP).map(([value, { label }]) => ({ value, label }));
export const REFUND_STATUS_OPTIONS = Object.entries(REFUND_STATUS_MAP).map(([value, { label }]) => ({ value, label }));

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "other", label: "Autre" },
];

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: "salaires", label: "Salaires" },
  { value: "loyer", label: "Loyer" },
  { value: "fournitures", label: "Fournitures" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
  { value: "services", label: "Services" },
  { value: "autres", label: "Autres" },
];
