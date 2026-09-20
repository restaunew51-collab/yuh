"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EnrollmentFormDialog, ENROLLMENT_STATUS_OPTIONS } from "@/components/enrollments/enrollment-form-dialog";
import { TransferClassDialog } from "@/components/enrollments/transfer-class-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  ArrowLeft, Pencil, ArrowRightLeft, User, BookOpen, Calendar, Hash,
  ClipboardCheck, Award, Wallet, FileText, History,
} from "lucide-react";

type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type ClassTransfer = Database["public"]["Tables"]["class_transfers"]["Row"];

type EnrollmentDetail = Enrollment & {
  students?: { student_number: string; profile_id: string | null };
  courses?: { name: string; programs?: { name: string } };
  classes?: { name: string; capacity: number; room: string | null };
  academic_years?: { name: string };
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  active: { label: "Active", variant: "default" },
  completed: { label: "Terminée", variant: "secondary" },
  withdrawn: { label: "Retirée", variant: "destructive" },
  transferred: { label: "Transférée", variant: "secondary" },
};

type TransferWithClasses = ClassTransfer & {
  from_class?: { name: string };
  to_class?: { name: string };
};

export default function EnrollmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [transfers, setTransfers] = useState<TransferWithClasses[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canUpdate = permissions.includes("enrollments.update" as never);
  const canTransfer = permissions.includes("class_transfers.create" as never);

  const fetchEnrollment = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, students(student_number, profile_id), courses(name, programs(name)), classes(name, capacity, room), academic_years(name)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) { setEnrollment(null); return; }
    setEnrollment(data);
  }, [id]);

  const fetchTransfers = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("class_transfers")
      .select("*, from_class:classes!from_class_id(name), to_class:classes!to_class_id(name)")
      .eq("enrollment_id", id)
      .order("transfer_date", { ascending: false });
    setTransfers(data ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchEnrollment(), fetchTransfers()]);
      setLoading(false);
    })();
  }, [fetchEnrollment, fetchTransfers]);

  if (loading) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/enrollments")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><LoadingState /></div>;
  }

  if (!enrollment) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/enrollments")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><EmptyState title="Inscription introuvable" /></div>;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/enrollments")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
      </Button>

      <PageHeader
        title={enrollment.students?.student_number ?? "Inscription"}
        description={`${enrollment.courses?.name ?? "—"} — ${enrollment.academic_years?.name ?? "—"}`}
        action={
          <div className="flex gap-2">
            {canUpdate && (
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" /> Modifier
              </Button>
            )}
            {canTransfer && enrollment.status === "active" && (
              <Button onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Transférer
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <Badge variant={STATUS_BADGE[enrollment.status]?.variant ?? "outline"}>
          {STATUS_BADGE[enrollment.status]?.label ?? enrollment.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Classe : {enrollment.classes?.name ?? "—"}
        </span>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info"><User className="w-4 h-4 mr-2" /> Informations</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" /> Historique</TabsTrigger>
          <TabsTrigger value="attendance"><ClipboardCheck className="w-4 h-4 mr-2" /> Présences</TabsTrigger>
          <TabsTrigger value="grades"><Award className="w-4 h-4 mr-2" /> Notes</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="w-4 h-4 mr-2" /> Paiements</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-2" /> Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow icon={Hash} label="Matricule" value={enrollment.students?.student_number ?? "—"} />
              <InfoRow icon={BookOpen} label="Formation" value={enrollment.courses?.name ?? "—"} />
              <InfoRow icon={BookOpen} label="Programme" value={enrollment.courses?.programs?.name ?? "—"} />
              <InfoRow icon={Calendar} label="Année académique" value={enrollment.academic_years?.name ?? "—"} />
              <InfoRow icon={User} label="Classe" value={enrollment.classes?.name ?? "—"} />
              <InfoRow icon={Calendar} label="Date d'inscription" value={new Date(enrollment.enrollment_date).toLocaleDateString("fr-FR")} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-6">
            {transfers.length === 0 ? (
              <EmptyState title="Aucun transfert" message="Aucun transfert de classe enregistré pour cette inscription." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Classe d'origine</TableHead>
                      <TableHead>Nouvelle classe</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">{new Date(t.transfer_date).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>{t.from_class?.name ?? "—"}</TableCell>
                        <TableCell>{t.to_class?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

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
        <TabsContent value="payments">
          <Card className="p-6"><EmptyState title="Module à venir" message="La gestion des paiements sera disponible dans un prochain module." /></Card>
        </TabsContent>
        <TabsContent value="documents">
          <Card className="p-6"><EmptyState title="Module à venir" message="La gestion des documents sera disponible dans un prochain module." /></Card>
        </TabsContent>
      </Tabs>

      <EnrollmentFormDialog open={formOpen} onOpenChange={setFormOpen} enrollment={enrollment} onSaved={() => { fetchEnrollment(); fetchTransfers(); }} />
      <TransferClassDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        enrollmentId={enrollment.id}
        currentClassId={enrollment.class_id}
        courseId={enrollment.course_id}
        studentName={enrollment.students?.student_number ?? "Étudiant"}
        currentClassName={enrollment.classes?.name ?? "—"}
        onTransferred={() => { fetchEnrollment(); fetchTransfers(); }}
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
