"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Upload, Search, Download, Trash2, FileText, MoveHorizontal as MoreHorizontal, Loader as Loader2, X } from "lucide-react";

type Document = Database["public"]["Tables"]["documents"]["Row"];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Toutes les catégories" },
  { value: "certificate", label: "Certificats" },
  { value: "transcript", label: "Relevés de notes" },
  { value: "receipt", label: "Reçus" },
  { value: "invoice", label: "Factures" },
  { value: "id_document", label: "Pièces d'identité" },
  { value: "administrative", label: "Documents administratifs" },
  { value: "other", label: "Autres" },
];

const CATEGORY_LABELS: Record<string, string> = {
  certificate: "Certificat",
  transcript: "Relevé de notes",
  receipt: "Reçu",
  invoice: "Facture",
  id_document: "Pièce d'identité",
  administrative: "Administratif",
  other: "Autre",
};

type EntityType = "institution" | "student" | "teacher" | "applicant" | "class";

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "institution", label: "Institution" },
  { value: "student", label: "Étudiant" },
  { value: "teacher", label: "Formateur" },
  { value: "applicant", label: "Candidat" },
  { value: "class", label: "Classe" },
];

export default function DocumentsPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = permissions.includes("documents.create" as never);
  const canDelete = permissions.includes("documents.delete" as never);
  const canView = permissions.includes("documents.view" as never) || canCreate;

  const fetchDocuments = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("documents")
        .select("*")
        .eq("institution_id", profile.institution_id);

      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, categoryFilter, search]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from(doc.is_confidential ? "admin-docs" : "student-docs")
        .createSignedUrl(doc.storage_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Téléchargement impossible.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error: storageError } = await supabase.storage
        .from(deleting.is_confidential ? "admin-docs" : "student-docs")
        .remove([deleting.storage_path]);
      if (storageError) throw storageError;

      const { error } = await supabase.from("documents").delete().eq("id", deleting.id);
      if (error) throw error;

      toast({ title: "Document supprimé" });
      setDeleting(null);
      fetchDocuments();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Suppression impossible.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!canView) {
    return (
      <div>
        <PageHeader title="Documents" />
        <Card className="p-6">
          <EmptyState title="Accès refusé" message="Vous n'avez pas la permission d'accéder à cette section." />
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div><PageHeader title="Documents" description="Gestion des documents" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Gestion et classement des documents"
        action={canCreate && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Téléverser
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            title="Aucun document"
            message="Téléversez votre premier document."
            action={canCreate && (
              <Button onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-2" /> Téléverser</Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Confidentiel</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {doc.name}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{CATEGORY_LABELS[doc.category] ?? doc.category}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} Ko` : "—"}</TableCell>
                    <TableCell>{doc.is_confidential ? <Badge variant="outline">Confidentiel</Badge> : <Badge variant="secondary">Public</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="w-4 h-4 mr-2" /> Télécharger
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(doc)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
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
        )}
      </Card>

      {canCreate && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          institutionId={profile?.institution_id ?? ""}
          profileId={profile?.id ?? ""}
          onSaved={fetchDocuments}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action supprimera le fichier définitivement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadDialog({
  open, onOpenChange, institutionId, profileId, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  profileId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("administrative");
  const [isConfidential, setIsConfidential] = useState(true);
  const [entityType, setEntityType] = useState<EntityType>("institution");
  const [entityId, setEntityId] = useState("");
  const [entityOptions, setEntityOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setCategory("administrative");
      setIsConfidential(true);
      setEntityType("institution");
      setEntityId("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open || !institutionId) return;
    loadEntityOptions(entityType, institutionId).then(setEntityOptions);
    setEntityId("");
  }, [open, entityType, institutionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !institutionId) return;

    setUploading(true);
    try {
      const bucket = isConfidential ? "admin-docs" : "student-docs";
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${institutionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: docRecord, error: docError } = await supabase
        .from("documents")
        .insert({
          institution_id: institutionId,
          category,
          name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          file_size: file.size,
          uploaded_by: profileId,
          is_confidential: isConfidential,
        })
        .select()
        .single();

      if (docError) throw docError;

      if (entityId && entityType !== "institution") {
        const linkTable = `document_${entityType === "student" ? "students" : entityType === "teacher" ? "teachers" : entityType === "applicant" ? "applicants" : "classes"}`;
        const linkCol = `${entityType}_id`;
        const linkData: Record<string, string> = { document_id: docRecord.id, [linkCol]: entityId };

        const { error: linkError } = await supabase.from(linkTable).insert(linkData);
        if (linkError) throw linkError;
      } else if (entityType === "institution") {
        const { error: linkError } = await supabase
          .from("document_institutions")
          .insert({ document_id: docRecord.id, institution_id: institutionId });
        if (linkError) throw linkError;
      }

      toast({ title: "Document téléversé" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Téléversement impossible.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Téléverser un document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Fichier *</Label>
            <Input id="file" type="file" ref={fileRef} onChange={handleFileChange} disabled={uploading} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory} disabled={uploading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.filter((c) => c.value !== "all").map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilité</Label>
              <Select value={isConfidential ? "confidential" : "public"} onValueChange={(v) => setIsConfidential(v === "confidential")} disabled={uploading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidential">Confidentiel</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Associé à</Label>
              <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)} disabled={uploading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {entityType !== "institution" && (
              <div className="space-y-2">
                <Label>Sélection</Label>
                <Select value={entityId} onValueChange={setEntityId} disabled={uploading || entityOptions.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Annuler</Button>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Téléversement...</> : <><Upload className="w-4 h-4 mr-2" /> Téléverser</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function loadEntityOptions(type: EntityType, institutionId: string): Promise<{ id: string; label: string }[]> {
  if (type === "institution") return [];
  if (type === "student") {
    const { data } = await supabase.from("students").select("id, student_number").eq("institution_id", institutionId).order("student_number");
    return (data ?? []).map((s) => ({ id: s.id, label: s.student_number }));
  }
  if (type === "teacher") {
    const { data } = await supabase.from("teachers").select("id, teacher_number, specialization").eq("institution_id", institutionId).order("teacher_number");
    return (data ?? []).map((t) => ({ id: t.id, label: `${t.teacher_number}${t.specialization ? ` - ${t.specialization}` : ""}` }));
  }
  if (type === "applicant") {
    const { data } = await supabase.from("applicants").select("id, first_name, last_name").eq("institution_id", institutionId).order("last_name");
    return (data ?? []).map((a) => ({ id: a.id, label: `${a.last_name} ${a.first_name}` }));
  }
  if (type === "class") {
    const { data } = await supabase.from("classes").select("id, name").eq("institution_id", institutionId).order("name");
    return (data ?? []).map((c) => ({ id: c.id, label: c.name }));
  }
  return [];
}
