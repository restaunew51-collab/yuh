"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ApplicantStatusBadge, APPLICANT_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { ApplicantFormDialog } from "@/components/applicants/applicant-form-dialog";
import { ConvertToStudentDialog } from "@/components/applicants/convert-to-student-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  UserCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];

const PAGE_SIZE = 10;

type SortField = "application_date" | "last_name" | "created_at";
type SortOrder = "asc" | "desc";

export default function ApplicantsPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<Applicant | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertApplicant, setConvertApplicant] = useState<Applicant | null>(null);
  const [deleteApplicant, setDeleteApplicant] = useState<Applicant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = permissions.includes("applicants.create" as never);
  const canUpdate = permissions.includes("applicants.update" as never);
  const canDelete = permissions.includes("applicants.delete" as never);
  const canConvert = permissions.includes("students.create" as never);

  const fetchApplicants = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("applicants")
        .select("*", { count: "exact" })
        .eq("institution_id", profile.institution_id);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim}%,email.ilike.%${search.trim}%,phone.ilike.%${search.trim}%`
        );
      }

      query = query.order(sortField, { ascending: sortOrder === "asc" });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setApplicants(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, search, sortField, sortOrder, page]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(0);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleStatusChange = async (applicant: Applicant, newStatus: string) => {
    try {
      const { error: updateError } = await supabase
        .from("applicants")
        .update({ status: newStatus })
        .eq("id", applicant.id);

      if (updateError) throw updateError;

      toast({ title: "Statut mis à jour", description: `Le statut a été changé en "${newStatus}".` });
      fetchApplicants();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteApplicant) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("applicants")
        .delete()
        .eq("id", deleteApplicant.id);

      if (deleteError) throw deleteError;

      toast({ title: "Candidat supprimé", description: "La candidature a été supprimée." });
      setDeleteApplicant(null);
      fetchApplicants();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasApplicants = applicants.length > 0;

  if (loading && applicants.length === 0) {
    return (
      <div>
        <PageHeader title="Candidats" description="Gestion des candidatures" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Candidats" description="Gestion des candidatures" />
        <ErrorState message={error} action={
          <Button variant="outline" size="sm" onClick={fetchApplicants}>Réessayer</Button>
        } />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Candidats"
        description="Gestion des candidatures"
        action={
          canCreate && (
            <Button
              onClick={() => {
                setEditingApplicant(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle candidature
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {APPLICANT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hasApplicants ? (
          <EmptyState
            title="Aucune candidature"
            message="Aucun candidat ne correspond à vos critères."
            action={
              canCreate && (
                <Button
                  onClick={() => {
                    setEditingApplicant(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un candidat
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("last_name")}
                      >
                        Nom
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("application_date")}
                      >
                        Date
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/app/admin/applicants/${a.id}`)}
                    >
                      <TableCell className="font-medium">
                        {a.last_name} {a.first_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(a.application_date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <ApplicantStatusBadge status={a.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/app/admin/applicants/${a.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir la fiche
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingApplicant(a);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                            )}
                            {canUpdate && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange(a, "reviewing")}>
                                  <Badge variant="outline" className="mr-2">En cours</Badge>
                                  Marquer en étude
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(a, "waitlisted")}>
                                  <Badge variant="outline" className="mr-2">Attente</Badge>
                                  Liste d'attente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(a, "rejected")}>
                                  <Badge variant="destructive" className="mr-2">Refus</Badge>
                                  Refuser
                                </DropdownMenuItem>
                              </>
                            )}
                            {canConvert && a.status !== "admitted" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setConvertApplicant(a);
                                    setConvertOpen(true);
                                  }}
                                >
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Convertir en étudiant
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteApplicant(a)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {totalCount} candidature{totalCount > 1 ? "s" : ""} au total
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <ApplicantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        applicant={editingApplicant}
        onSaved={fetchApplicants}
      />

      {convertApplicant && (
        <ConvertToStudentDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          applicantId={convertApplicant.id}
          applicantName={`${convertApplicant.last_name} ${convertApplicant.first_name}`}
          onConverted={fetchApplicants}
        />
      )}

      <AlertDialog
        open={!!deleteApplicant}
        onOpenChange={(open) => !open && setDeleteApplicant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette candidature ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la candidature de{" "}
              {deleteApplicant && `${deleteApplicant.last_name} ${deleteApplicant.first_name}`} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
