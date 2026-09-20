"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StudentStatusBadge, STUDENT_STATUS_OPTIONS } from "@/components/shared/status-badge";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
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
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

type Student = Database["public"]["Tables"]["students"]["Row"];

const PAGE_SIZE = 10;

type SortField = "student_number" | "admission_date" | "created_at";
type SortOrder = "asc" | "desc";

export default function StudentsPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = permissions.includes("students.create" as never);
  const canUpdate = permissions.includes("students.update" as never);
  const canDelete = permissions.includes("students.delete" as never);

  const fetchStudents = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("students")
        .select("*", { count: "exact" })
        .eq("institution_id", profile.institution_id);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.or(`student_number.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,first_name.ilike.%${search.trim()}%`);
      }

      query = query.order(sortField, { ascending: sortOrder === "asc" });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setStudents(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, search, sortField, sortOrder, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

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
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", deleteStudent.id);

      if (deleteError) throw deleteError;

      toast({ title: "Étudiant supprimé", description: "Le dossier étudiant a été supprimé." });
      setDeleteStudent(null);
      fetchStudents();
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
  const hasStudents = students.length > 0;

  if (loading && students.length === 0) {
    return (
      <div>
        <PageHeader title="Étudiants" description="Gestion des étudiants inscrits" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Étudiants" description="Gestion des étudiants inscrits" />
        <ErrorState message={error} action={
          <Button variant="outline" size="sm" onClick={fetchStudents}>Réessayer</Button>
        } />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Étudiants"
        description="Gestion des étudiants inscrits"
        action={
          canCreate && (
            <Button
              onClick={() => {
                setEditingStudent(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvel étudiant
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par matricule ou nom..."
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
              {STUDENT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hasStudents ? (
          <EmptyState
            title="Aucun étudiant"
            message="Aucun étudiant ne correspond à vos critères."
            action={
              canCreate && (
                <Button
                  onClick={() => {
                    setEditingStudent(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un étudiant
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
                        onClick={() => handleSort("student_number")}
                      >
                        Matricule
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort("admission_date")}
                      >
                        Admission
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/app/admin/students/${s.id}`)}
                    >
                      <TableCell className="font-medium">{s.student_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.last_name || s.first_name ? `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.admission_date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <StudentStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/app/admin/students/${s.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir la fiche
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingStudent(s);
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
                                onClick={() => setDeleteStudent(s)}
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
                {totalCount} étudiant{totalCount > 1 ? "s" : ""} au total
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

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        student={editingStudent}
        onSaved={fetchStudents}
      />

      <AlertDialog
        open={!!deleteStudent}
        onOpenChange={(open) => !open && setDeleteStudent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet étudiant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le dossier de{" "}
              {deleteStudent?.student_number} ? Cette action est irréversible.
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
