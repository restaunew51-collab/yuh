"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ApplicantStatusBadge, APPLICANT_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { ApplicantFormDialog } from "@/components/applicants/applicant-form-dialog";
import { ConvertToStudentDialog } from "@/components/applicants/convert-to-student-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Pencil,
  UserCheck,
  Calendar,
  Mail,
  Phone,
  User,
  FileText,
  History,
} from "lucide-react";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];
type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions, profile } = useAuth();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [documents, setDocuments] = useState<Database["public"]["Tables"]["documents"]["Row"][]>([]);

  const canUpdate = permissions.includes("applicants.update" as never);
  const canConvert = permissions.includes("students.create" as never);

  const fetchApplicant = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("applicants")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError("Candidat introuvable.");
        return;
      }
      setApplicant(data);
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
        .eq("table_name", "applicants")
        .eq("record_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLogs(data ?? []);
    } catch {
      setAuditLogs([]);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("document_applicants")
        .select("document_id, documents(*)")
        .eq("applicant_id", id);
      const docs = (data ?? [])
        .map((item: unknown) => (item as { documents: Database["public"]["Tables"]["documents"]["Row"] }).documents)
        .filter(Boolean);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }, [id]);

  useEffect(() => {
    fetchApplicant();
  }, [fetchApplicant]);

  useEffect(() => {
    fetchAuditLogs();
    fetchDocuments();
  }, [fetchAuditLogs, fetchDocuments]);

  const handleStatusChange = async (newStatus: string) => {
    if (!applicant) return;
    try {
      const { error: updateError } = await supabase
        .from("applicants")
        .update({ status: newStatus })
        .eq("id", applicant.id);

      if (updateError) throw updateError;

      setApplicant({ ...applicant, status: newStatus as Applicant["status"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/applicants")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <LoadingState />
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/applicants")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        {error ? <ErrorState message={error} action={
          <Button variant="outline" size="sm" onClick={fetchApplicant}>Réessayer</Button>
        } /> : <EmptyState title="Candidat introuvable" />}
      </div>
    );
  }

  const fullName = `${applicant.last_name} ${applicant.first_name}`;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/applicants")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour à la liste
      </Button>

      <PageHeader
        title={fullName}
        description={`Candidature du ${new Date(applicant.application_date).toLocaleDateString("fr-FR")}`}
        action={
          <div className="flex gap-2">
            {canUpdate && (
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            )}
            {canConvert && applicant.status !== "admitted" && (
              <Button onClick={() => setConvertOpen(true)}>
                <UserCheck className="w-4 h-4 mr-2" />
                Convertir en étudiant
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <ApplicantStatusBadge status={applicant.status} />
        {canUpdate && (
          <Select value={applicant.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICANT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">
            <User className="w-4 h-4 mr-2" />
            Identité
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

        <TabsContent value="identity">
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoRow icon={User} label="Nom" value={applicant.last_name} />
              <InfoRow icon={User} label="Prénom" value={applicant.first_name} />
              <InfoRow icon={Mail} label="Email" value={applicant.email ?? "—"} />
              <InfoRow icon={Phone} label="Téléphone" value={applicant.phone ?? "—"} />
              <InfoRow icon={Calendar} label="Date de candidature" value={new Date(applicant.application_date).toLocaleDateString("fr-FR")} />
              <InfoRow icon={Calendar} label="Créé le" value={new Date(applicant.created_at).toLocaleDateString("fr-FR")} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-6">
            {documents.length === 0 ? (
              <EmptyState title="Aucun document" message="Aucun document n'est associé à cette candidature." />
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.category}</p>
                      </div>
                    </div>
                    {doc.is_confidential && <Badge variant="outline">Confidentiel</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

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

      <ApplicantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        applicant={applicant}
        onSaved={fetchApplicant}
      />

      <ConvertToStudentDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        applicantId={applicant.id}
        applicantName={fullName}
        onConverted={() => {
          fetchApplicant();
          fetchAuditLogs();
        }}
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
