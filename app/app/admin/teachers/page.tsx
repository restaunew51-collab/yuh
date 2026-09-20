"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { TeacherStatusBadge, TEACHER_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { TeacherFormDialog } from "@/components/teachers/teacher-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

type Teacher = Database["public"]["Tables"]["teachers"]["Row"];

const PAGE_SIZE = 10;

type SortField = "teacher_number" | "specialization" | "created_at";
type SortOrder = "asc" | "desc";

export default function TeachersPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = permissions.includes("teachers.create" as never);
  const canUpdate = permissions.includes("teachers.update" as never);
  const canDelete = permissions.includes("teachers.delete" as never);

  const fetchTeachers = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("teachers")
        .select("*", { count: "exact" })
        .eq("institution_id", profile.institution_id);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.ilike("teacher_number", `%${search.trim()}%`);
      }

      query = query.order(sortField, { ascending: sortOrder === "asc" });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setTeachers(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, search, sortField, sortOrder, page]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

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

  const handleDelete = async () => {
    if (!deleteTeacher) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("teachers")
        .delete()
        .eq("id", deleteTeacher.id);

      if (deleteError) throw deleteError;

      toast({ title: "Formateur supprimé", description: "Le formateur a été supprimé." });
      setDeleteTeacher(null);
      fetchTeachers();
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
  const hasTeachers = teachers.length > 0;

  if (loading && teachers.length === 0) {
    return (
      <div>
        <PageHeader title="Formateurs" description="Gestion des formateurs" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Formateurs" description="Gestion des formateurs" />
        <ErrorState message={error} action={
          <Button variant="outline" size="sm" onClick={fetchTeachers}>Réessayer</Button>
        } />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Formateurs"
        description="Gestion des formateurs"
        action={
          canCreate && (
            <Button
              onClick={() => {
                setEditingTeacher(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau formateur
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro..."
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
              {TEACHER_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hasTeachers ? (
          <EmptyState
            title="Aucun formateur"
            message="Aucun formateur ne correspond à vos critères."
            action={
              canCreate && (
                <Button
                  onClick={() => {
                    setEditingTeacher(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un formateur
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
                        onClick={() => handleSort("teacher_number")}
                      >
                        Numéro
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("specialization")}
                      >
                        Spécialisation
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Profil</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("created_at")}
                      >
                        Créé le
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.teacher_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.specialization ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.profile_id ? "Profil lié" : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <TeacherStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingTeacher(t);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTeacher(t)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
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

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {totalCount} formateur{totalCount > 1 ? "s" : ""} au total
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

      <TeacherFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        teacher={editingTeacher}
        onSaved={fetchTeachers}
      />

      <AlertDialog
        open={!!deleteTeacher}
        onOpenChange={(open) => !open && setDeleteTeacher(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce formateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le formateur{" "}
              {deleteTeacher?.teacher_number} ? Cette action est irréversible.
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
