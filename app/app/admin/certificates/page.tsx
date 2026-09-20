"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Plus, Search, MoveHorizontal as MoreHorizontal, Award, CircleCheck as CheckCircle2, Circle as XCircle, QrCode, Eye } from "lucide-react";

type Certificate = Database["public"]["Tables"]["certificates"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type Course = Database["public"]["Tables"]["courses"]["Row"];

type CertificateWithRelations = Certificate & {
  students?: { student_number: string; profile_id: string | null };
  courses?: { name: string };
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "outline" },
  issued: { label: "Émis", variant: "default" },
  validated: { label: "Validé", variant: "secondary" },
  revoked: { label: "Révoqué", variant: "destructive" },
};

export default function CertificatesPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [certificates, setCertificates] = useState<CertificateWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [revoking, setRevoking] = useState<Certificate | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<CertificateWithRelations | null | "not_found" | "loading">(null);

  const canCreate = permissions.includes("certificates.create" as never);
  const canVerify = permissions.includes("certificates.verify" as never);
  const canView = permissions.includes("certificates.view" as never) || canCreate;

  const fetchCertificates = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      const studentIds = (await supabase.from("students").select("id").eq("institution_id", profile.institution_id)).data?.map((r: { id: string }) => r.id) ?? [];
      if (studentIds.length === 0) { setCertificates([]); return; }

      let query = supabase
        .from("certificates")
        .select("*, students(student_number, profile_id), courses(name)")
        .in("student_id", studentIds);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search.trim()) query = query.ilike("certificate_number", `%${search.trim()}%`);
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setCertificates(data ?? []);
    } catch {
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, search]);

  useEffect(() => { fetchCertificates(); }, [fetchCertificates]);

  const handleStatusChange = async (cert: Certificate, newStatus: string) => {
    try {
      const updateData: Record<string, string | null> = { status: newStatus };
      if (newStatus === "validated") updateData.validated_by = profile?.id ?? null;

      const { error } = await supabase.from("certificates").update(updateData).eq("id", cert.id);
      if (error) throw error;
      toast({ title: "Statut mis à jour" });
      fetchCertificates();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleVerify = async () => {
    if (!verifyToken.trim()) return;
    setVerifyResult("loading");
    try {
      const { data, error } = await supabase
        .from("certificates")
        .select("*, students(student_number, profile_id), courses(name)")
        .eq("qr_token", verifyToken.trim())
        .maybeSingle();

      if (error) throw error;
      setVerifyResult(data ?? "not_found");
    } catch {
      setVerifyResult("not_found");
    }
  };

  if (!canView) {
    return (
      <div>
        <PageHeader title="Certificats" />
        <Card className="p-6">
          <EmptyState title="Accès refusé" message="Vous n'avez pas la permission d'accéder à cette section." />
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div><PageHeader title="Certificats" description="Gestion des certificats et attestations" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Certificats"
        description="Gestion des certificats et attestations"
        action={
          <div className="flex gap-2">
            {canVerify && (
              <Button variant="outline" onClick={() => { setVerifyOpen(true); setVerifyResult(null); setVerifyToken(""); }}>
                <QrCode className="w-4 h-4 mr-2" /> Vérifier
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nouveau certificat
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par numéro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {certificates.length === 0 ? (
          <EmptyState
            title="Aucun certificat"
            message="Créez un certificat pour un étudiant."
            action={canCreate && (
              <Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Formation</TableHead>
                  <TableHead>Date d'émission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">{cert.certificate_number}</TableCell>
                    <TableCell className="text-muted-foreground">{cert.students?.student_number ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{cert.courses?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(cert.issue_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[cert.status]?.variant ?? "outline"}>
                        {STATUS_CONFIG[cert.status]?.label ?? cert.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canCreate && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {cert.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(cert, "issued")}>
                                <Award className="w-4 h-4 mr-2" /> Émettre
                              </DropdownMenuItem>
                            )}
                            {cert.status === "issued" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(cert, "validated")}>
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Valider
                              </DropdownMenuItem>
                            )}
                            {(cert.status === "issued" || cert.status === "validated") && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setRevoking(cert)}>
                                <XCircle className="w-4 h-4 mr-2" /> Révoquer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {canCreate && (
        <CertificateFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          institutionId={profile?.institution_id ?? ""}
          profileId={profile?.id ?? ""}
          onSaved={fetchCertificates}
        />
      )}

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer ce certificat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le certificat {revoking?.certificate_number} sera marqué comme révoqué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (revoking) handleStatusChange(revoking, "revoked"); setRevoking(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Vérification de certificat</DialogTitle>
            <DialogDescription>Saisissez le numéro ou le code QR du certificat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: CERT-2026-00001"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
              />
              <Button onClick={handleVerify} disabled={verifyResult === "loading"}>
                {verifyResult === "loading" ? "..." : "Vérifier"}
              </Button>
            </div>

            {verifyResult === "loading" && <LoadingState message="Vérification..." />}

            {verifyResult === "not_found" && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">Certificat introuvable</p>
                    <p className="text-xs text-muted-foreground">Aucun certificat ne correspond à ce code.</p>
                  </div>
                </div>
              </Card>
            )}

            {verifyResult && verifyResult !== "not_found" && verifyResult !== "loading" && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {verifyResult.status === "validated" ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : verifyResult.status === "revoked" ? (
                    <XCircle className="w-8 h-8 text-destructive" />
                  ) : (
                    <Award className="w-8 h-8 text-amber-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{verifyResult.certificate_number}</p>
                    <Badge variant={STATUS_CONFIG[verifyResult.status]?.variant ?? "outline"}>
                      {STATUS_CONFIG[verifyResult.status]?.label ?? verifyResult.status}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Étudiant</p><p className="font-medium">{verifyResult.students?.student_number ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Formation</p><p className="font-medium">{verifyResult.courses?.name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Date d'émission</p><p className="font-medium">{new Date(verifyResult.issue_date).toLocaleDateString("fr-FR")}</p></div>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CertificateFormDialog({
  open, onOpenChange, institutionId, profileId, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  profileId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && institutionId) {
      supabase.from("students").select("*").eq("institution_id", institutionId).order("student_number")
        .then(({ data }) => setStudents(data ?? []));
      supabase.from("courses").select("*").eq("institution_id", institutionId).order("name")
        .then(({ data }) => setCourses(data ?? []));
      setStudentId("");
      setCourseId("");
      setIssueDate(new Date().toISOString().split("T")[0]);
      setErrors({});
    }
  }, [open, institutionId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!studentId) e.studentId = "L'étudiant est requis";
    if (!courseId) e.courseId = "La formation est requise";
    if (!issueDate) e.issueDate = "La date est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const certificateNumber = `CERT-${year}-${random}`;
      const qrToken = `${certificateNumber}-${Date.now().toString(36)}`;

      const { error } = await supabase.from("certificates").insert({
        student_id: studentId,
        course_id: courseId,
        certificate_number: certificateNumber,
        issue_date: issueDate,
        status: "draft",
        qr_token: qrToken,
        created_by: profileId,
      });

      if (error) throw error;
      toast({ title: "Certificat créé", description: `Numéro: ${certificateNumber}` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Création impossible.",
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
          <DialogTitle>Nouveau certificat</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Étudiant *</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.student_number}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.studentId && <p className="text-xs text-destructive">{errors.studentId}</p>}
          </div>
          <div className="space-y-2">
            <Label>Formation *</Label>
            <Select value={courseId} onValueChange={setCourseId} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.courseId && <p className="text-xs text-destructive">{errors.courseId}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-date">Date d'émission *</Label>
            <Input id="issue-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={loading} />
            {errors.issueDate && <p className="text-xs text-destructive">{errors.issueDate}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
