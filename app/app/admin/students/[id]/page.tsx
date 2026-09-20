"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StudentStatusBadge, STUDENT_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { CreateStudentAccountDialog } from "@/components/students/create-student-account-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  PaymentPlanStatusBadge,
  InstallmentStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import { PaymentFormDialog } from "@/components/finance/payment-form-dialog";
import { RefundFormDialog } from "@/components/finance/refund-form-dialog";
import {
  ArrowLeft,
  Pencil,
  Calendar,
  User,
  Hash,
  FileText,
  ClipboardCheck,
  Award,
  Wallet,
  BookOpen,
  History,
  Banknote,
  RotateCcw,
  Mail,
  Phone,
  MapPin,
  Globe,
  Heart,
  ShieldAlert,
  Cake,
  Users,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type PaymentPlan = Database["public"]["Tables"]["payment_plans"]["Row"];
type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];

type EnrollmentWithRelations = Enrollment & {
  courses?: { name: string };
  classes?: { name: string };
  academic_years?: { name: string };
};

type PlanWithRelations = PaymentPlan & {
  courses?: { name: string };
  academic_years?: { name: string };
};

const CIVILITY_LABELS: Record<string, string> = { M: "M.", Mme: "Mme", Mlle: "Mlle" };
const GENDER_LABELS: Record<string, string> = { M: "Masculin", F: "Féminin" };
const MARITAL_LABELS: Record<string, string> = {
  celibataire: "Célibataire",
  marie: "Marié(e)",
  divorce: "Divorcé(e)",
  veuf: "Veuf/Veuve",
};

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PlanWithRelations[]>([]);
  const [planInstallments, setPlanInstallments] = useState<Record<string, Installment[]>>({});
  const [planPayments, setPlanPayments] = useState<Record<string, Payment[]>>({});
  const [paymentInstallment, setPaymentInstallment] = useState<Installment | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPlanForDialog, setPaymentPlanForDialog] = useState<PaymentPlan | null>(null);
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const canUpdate = permissions.includes("students.update" as never);
  const canCreatePayment = permissions.includes("payments.create" as never);
  const canRefund = permissions.includes("refunds.create" as never);

  const fetchStudent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError("Étudiant introuvable.");
        return;
      }
      setStudent(data);

      if (data.profile_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.profile_id)
          .maybeSingle();
        setProfileData(prof as Profile | null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAuditLogs = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "students")
        .eq("record_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLogs(data ?? []);
    } catch {
      setAuditLogs([]);
    }
  }, [id]);

  const fetchEnrollments = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("enrollments")
        .select("*, courses(name), classes(name), academic_years(name)")
        .eq("student_id", id)
        .order("enrollment_date", { ascending: false });
      setEnrollments(data ?? []);
    } catch {
      setEnrollments([]);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("document_students")
        .select("document_id, documents(*)")
        .eq("student_id", id);
      const docs = (data ?? [])
        .map((item: unknown) => (item as { documents: Document }).documents)
        .filter(Boolean) as Document[];
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }, [id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  const fetchPaymentPlans = useCallback(async () => {
    if (!id) return;
    try {
      const { data: plans } = await supabase
        .from("payment_plans")
        .select("*, courses(name), academic_years(name)")
        .eq("student_id", id)
        .order("created_at", { ascending: false });
      setPaymentPlans(plans ?? []);

      const instMap: Record<string, Installment[]> = {};
      const payMap: Record<string, Payment[]> = {};
      for (const plan of plans ?? []) {
        const { data: insts } = await supabase
          .from("installments")
          .select("*")
          .eq("payment_plan_id", plan.id)
          .order("installment_number", { ascending: true });
        instMap[plan.id] = insts ?? [];

        const instIds = (insts ?? []).map((i) => i.id);
        if (instIds.length > 0) {
          const { data: pays } = await supabase
            .from("payments")
            .select("*")
            .in("installment_id", instIds)
            .order("payment_date", { ascending: false });
          payMap[plan.id] = pays ?? [];
        } else {
          payMap[plan.id] = [];
        }
      }
      setPlanInstallments(instMap);
      setPlanPayments(payMap);
    } catch {
      setPaymentPlans([]);
    }
  }, [id]);

  useEffect(() => {
    fetchAuditLogs();
    fetchEnrollments();
    fetchPaymentPlans();
    fetchDocuments();
  }, [fetchAuditLogs, fetchEnrollments, fetchPaymentPlans, fetchDocuments]);

  const handleStatusChange = async (newStatus: string) => {
    if (!student) return;
    try {
      const { error: updateError } = await supabase
        .from("students")
        .update({ status: newStatus })
        .eq("id", student.id);

      if (updateError) throw updateError;

      setStudent({ ...student, status: newStatus as Student["status"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/students")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <LoadingState />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/students")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        {error ? <ErrorState message={error} action={
          <Button variant="outline" size="sm" onClick={fetchStudent}>Réessayer</Button>
        } /> : <EmptyState title="Étudiant introuvable" />}
      </div>
    );
  }

  const displayName = student.last_name || student.first_name
    ? `${student.last_name ?? ""} ${student.first_name ?? ""}`.trim()
    : student.student_number;

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarUrl = profileData?.avatar_url ?? null;

  const fullNameForDisplay = [
    student.civility ? CIVILITY_LABELS[student.civility] : null,
    student.last_name,
    student.first_name,
  ].filter(Boolean).join(" ");

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/students")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la liste
      </Button>

      <PageHeader
        title={displayName}
        description={`Matricule : ${student.student_number}`}
        action={
          canUpdate && (
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Avatar className="w-16 h-16">
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-primary text-white text-lg">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-3 flex-wrap">
          {student.profile_id ? (
            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
              <ShieldCheck className="w-3 h-3" />
              Compte portail actif
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <ShieldAlert className="w-3 h-3" />
              Aucun compte portail
            </Badge>
          )}
          <StudentStatusBadge status={student.status} />
          {canUpdate && (
            <Select value={student.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {student.email && (
            <Badge variant="outline" className="gap-1">
              <Mail className="w-3 h-3" />
              {student.email}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="flex-wrap">
          <TabsTrigger value="identity">
            <User className="w-4 h-4 mr-2" />
            Identité
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Phone className="w-4 h-4 mr-2" />
            Coordonnées
          </TabsTrigger>
          <TabsTrigger value="complementary">
            <Globe className="w-4 h-4 mr-2" />
            Info complémentaires
          </TabsTrigger>
          <TabsTrigger value="academics">
            <BookOpen className="w-4 h-4 mr-2" />
            Scolarité
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Présences
          </TabsTrigger>
          <TabsTrigger value="grades">
            <Award className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Wallet className="w-4 h-4 mr-2" />
            Paiements
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Onglet Identité */}
        <TabsContent value="identity">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Identité</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <InfoRow icon={Hash} label="Matricule" value={student.student_number} />
              <InfoRow icon={User} label="Civilité" value={student.civility ? CIVILITY_LABELS[student.civility] ?? student.civility : "—"} />
              <InfoRow icon={User} label="Nom complet" value={fullNameForDisplay || "—"} />
              <InfoRow icon={User} label="Nom" value={student.last_name ?? "—"} />
              <InfoRow icon={User} label="Prénom(s)" value={student.first_name ?? "—"} />
              <InfoRow icon={Calendar} label="Date d'admission" value={new Date(student.admission_date).toLocaleDateString("fr-FR")} />
              <InfoRow icon={Cake} label="Date de naissance" value={student.birth_date ? new Date(student.birth_date).toLocaleDateString("fr-FR") : "—"} />
              <InfoRow icon={MapPin} label="Lieu de naissance" value={student.birth_place ?? "—"} />
              <InfoRow icon={Users} label="Sexe" value={student.gender ? GENDER_LABELS[student.gender] ?? student.gender : "—"} />
            </div>
          </Card>
        </TabsContent>

        {/* Onglet Coordonnées */}
        <TabsContent value="contact">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Coordonnées</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow icon={Mail} label="Email" value={student.email ?? "—"} />
              <InfoRow icon={Phone} label="Téléphone (profil)" value={profileData?.phone ?? "—"} />
              <InfoRow icon={MapPin} label="Adresse" value={student.address ?? "—"} />
            </div>
            {profileData && (
              <p className="text-xs text-muted-foreground mt-4">
                Le téléphone provient du profil utilisateur lié ({profileData.first_name} {profileData.last_name}).
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Onglet Informations complémentaires */}
        <TabsContent value="complementary">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Informations complémentaires</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow icon={Globe} label="Nationalité" value={student.nationality ?? "—"} />
              <InfoRow icon={Heart} label="Situation matrimoniale" value={student.marital_status ? MARITAL_LABELS[student.marital_status] ?? student.marital_status : "—"} />
            </div>

            <div className="border-t mt-6 pt-6">
              <h4 className="text-sm font-semibold text-foreground mb-4">Contact d'urgence</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <InfoRow icon={User} label="Nom du contact" value={student.emergency_contact_name ?? "—"} />
                <InfoRow icon={Users} label="Lien avec l'étudiant" value={student.emergency_contact_relation ?? "—"} />
                <InfoRow icon={Phone} label="Téléphone" value={student.emergency_contact_phone ?? "—"} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Onglet Scolarité */}
        <TabsContent value="academics">
          <Card className="p-6">
            {enrollments.length === 0 ? (
              <EmptyState
                title="Aucune inscription"
                message="Cet étudiant n'a pas encore d'inscription. Créez une inscription depuis la page Inscriptions."
              />
            ) : (
              <div className="space-y-3">
                {enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/app/admin/enrollments/${e.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.courses?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.academic_years?.name ?? "—"} — Classe : {e.classes?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={e.status === "active" ? "default" : "outline"}>
                        {e.status === "active" ? "Active" : e.status === "pending" ? "En attente" : e.status === "completed" ? "Terminée" : e.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{new Date(e.enrollment_date).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Onglet Présences */}
        <TabsContent value="attendance">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-3">
              <EmptyState title="Présences" message="Consultez les présences de cet étudiant." />
              <Button variant="outline" onClick={() => router.push(`/app/admin/attendance`)}>
                <ClipboardCheck className="w-4 h-4 mr-2" /> Voir les présences
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Onglet Notes */}
        <TabsContent value="grades">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-3">
              <EmptyState title="Notes et bulletins" message="Consultez les évaluations et bulletins." />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/app/admin/grades`)}>
                  <Award className="w-4 h-4 mr-2" /> Évaluations
                </Button>
                <Button variant="outline" onClick={() => router.push(`/app/admin/bulletins`)}>
                  <FileText className="w-4 h-4 mr-2" /> Bulletins
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Onglet Paiements */}
        <TabsContent value="payments">
          <div className="space-y-4">
            {paymentPlans.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  title="Aucun échéancier"
                  message="Cet étudiant n'a pas encore d'échéancier de paiement. Créez-en un depuis la page Paiements."
                  action={
                    <Button variant="outline" onClick={() => router.push("/app/admin/payments")}>
                      <Wallet className="w-4 h-4 mr-2" /> Aller aux paiements
                    </Button>
                  }
                />
              </Card>
            ) : (
              paymentPlans.map((plan) => {
                const insts = planInstallments[plan.id] ?? [];
                const pays = planPayments[plan.id] ?? [];
                const totalPaid = insts.reduce((s, i) => s + Number(i.amount_paid), 0);
                const totalDue = insts.reduce((s, i) => s + Number(i.amount_due), 0);
                const remaining = totalDue - totalPaid;
                return (
                  <Card key={plan.id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium">{plan.courses?.name ?? "Formation"}</p>
                        <p className="text-xs text-muted-foreground">{plan.academic_years?.name ?? "—"}</p>
                      </div>
                      <PaymentPlanStatusBadge status={plan.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-muted text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Total dû</p>
                        <p className="font-bold">{Number(plan.total_amount).toLocaleString("fr-FR")} {plan.currency === "EUR" ? "€" : "FCFA"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Encaissé</p>
                        <p className="font-bold text-green-600">{totalPaid.toLocaleString("fr-FR")} {plan.currency === "EUR" ? "€" : "FCFA"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reste</p>
                        <p className="font-bold text-orange-600">{remaining.toLocaleString("fr-FR")} {plan.currency === "EUR" ? "€" : "FCFA"}</p>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold mb-2">Tranches</h4>
                    <div className="space-y-2 mb-4">
                      {insts.map((inst) => {
                        const instRemaining = Number(inst.amount_due) - Number(inst.amount_paid);
                        return (
                          <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{inst.label}</span>
                                <InstallmentStatusBadge status={inst.status} />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Dû : {Number(inst.amount_due).toLocaleString("fr-FR")} · Payé : {Number(inst.amount_paid).toLocaleString("fr-FR")} · Reste : {instRemaining.toLocaleString("fr-FR")}
                              </p>
                              <p className="text-xs text-muted-foreground">Échéance : {new Date(inst.due_date).toLocaleDateString("fr-FR")}</p>
                            </div>
                            {canCreatePayment && instRemaining > 0 && inst.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPaymentInstallment(inst);
                                  setPaymentPlanForDialog(plan);
                                  setPaymentOpen(true);
                                }}
                              >
                                <Banknote className="w-4 h-4 mr-1" /> Payer
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <h4 className="text-sm font-semibold mb-2">Historique des paiements</h4>
                    {pays.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Aucun paiement enregistré.</p>
                    ) : (
                      <div className="space-y-2">
                        {pays.map((pay) => (
                          <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <PaymentStatusBadge status={pay.status} />
                                <span className="text-sm font-medium">{Number(pay.amount).toLocaleString("fr-FR")} {plan.currency === "EUR" ? "€" : "FCFA"}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(pay.payment_date).toLocaleDateString("fr-FR")} · {pay.method}
                              </p>
                              {pay.note && <p className="text-xs text-muted-foreground">Note : {pay.note}</p>}
                            </div>
                            {canRefund && pay.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  setRefundPayment(pay);
                                  setRefundOpen(true);
                                }}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" /> Rembourser
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Onglet Documents */}
        <TabsContent value="documents">
          <Card className="p-6">
            {documents.length === 0 ? (
              <EmptyState title="Aucun document" message="Aucun document n'est associé à cet étudiant." />
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.is_confidential && <Badge variant="outline">Confidentiel</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="history">
          <Card className="p-6">
            {auditLogs.length === 0 ? (
              <EmptyState title="Aucun historique" message="Aucun événement d'audit enregistré." />
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <History className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {log.action === "INSERT" ? "Création" : log.action === "UPDATE" ? "Modification" : "Suppression"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {canUpdate && !student.profile_id && (
        <Button variant="default" onClick={() => setAccountOpen(true)} className="mb-4">
          <UserPlus className="w-4 h-4 mr-2" />
          Créer un compte étudiant
        </Button>
      )}

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        student={student}
        onSaved={fetchStudent}
      />

      <CreateStudentAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        student={student}
        onCreated={fetchStudent}
      />

      <PaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        installment={paymentInstallment}
        studentId={student.id}
        academicYearId={paymentPlanForDialog?.academic_year_id ?? ""}
        onSaved={fetchPaymentPlans}
      />

      <RefundFormDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        payment={refundPayment}
        onSaved={fetchPaymentPlans}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}
