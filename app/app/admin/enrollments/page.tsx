"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { EnrollmentFormDialog, ENROLLMENT_STATUS_OPTIONS } from "@/components/enrollments/enrollment-form-dialog";
import { TransferClassDialog } from "@/components/enrollments/transfer-class-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Plus, Search, MoreHorizontal, Eye, Pencil, ArrowRightLeft, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

type EnrollmentWithRelations = Enrollment & {
  students?: { student_number: string; profile_id: string | null };
  courses?: { name: string; programs?: { name: string } };
  classes?: { name: string };
  academic_years?: { name: string };
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  active: { label: "Active", variant: "default" },
  completed: { label: "Terminée", variant: "secondary" },
  withdrawn: { label: "Retirée", variant: "destructive" },
  transferred: { label: "Transférée", variant: "secondary" },
};

const PAGE_SIZE = 10;

export default function EnrollmentsPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<EnrollmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [transferEnrollment, setTransferEnrollment] = useState<EnrollmentWithRelations | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleting, setDeleting] = useState<Enrollment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = permissions.includes("enrollments.create" as never);
  const canUpdate = permissions.includes("enrollments.update" as never);
  const canDelete = permissions.includes("enrollments.delete" as never);
  const canTransfer = permissions.includes("class_transfers.create" as never);

  useEffect(() => {
    if (profile?.institution_id) {
      supabase.from("academic_years").select("id, name").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [profile?.institution_id]);

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("enrollments")
        .select("*, students(student_number, profile_id), courses(name, programs(name)), classes(name), academic_years(name)", { count: "exact" })
        .in("student_id",
          (await supabase.from("students").select("id").eq("institution_id", profile.institution_id)).data?.map((r: { id: string }) => r.id) ?? []);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (yearFilter !== "all") query = query.eq("academic_year_id", yearFilter);
      if (search.trim()) {
        query = query.or(`students.student_number.ilike.%${search.trim()}%`);
      }
      query = query.order("enrollment_date", { ascending: false });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      setItems(data ?? []);
      setTotalCount(count ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, statusFilter, yearFilter, search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("enrollments").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Inscription supprimée" });
      setDeleting(null);
      fetch();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && items.length === 0) {
    return <div><PageHeader title="Inscriptions" description="Gestion des inscriptions et affectations" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Inscriptions"
        description="Gestion des inscriptions et affectations"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle inscription
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par matricule..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Toutes les années" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {ENROLLMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Aucune inscription" message="Créez une inscription pour affecter un étudiant à une formation." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Formation</TableHead>
                    <TableHead>Année</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/app/admin/enrollments/${e.id}`)}>
                      <TableCell className="font-medium">{e.students?.student_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.courses?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.academic_years?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.classes?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant={STATUS_BADGE[e.status]?.variant ?? "outline"}>{STATUS_BADGE[e.status]?.label ?? e.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(e.enrollment_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/app/admin/enrollments/${e.id}`)}>
                              <Eye className="w-4 h-4 mr-2" /> Voir le détail
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => { setEditing(e); setFormOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Modifier
                              </DropdownMenuItem>
                            )}
                            {canTransfer && e.status === "active" && (
                              <DropdownMenuItem onClick={() => { setTransferEnrollment(e); setTransferOpen(true); }}>
                                <ArrowRightLeft className="w-4 h-4 mr-2" /> Transférer
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(e)}>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{totalCount} inscription{totalCount > 1 ? "s" : ""} au total</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <EnrollmentFormDialog open={formOpen} onOpenChange={setFormOpen} enrollment={editing} onSaved={fetch} />

      {transferEnrollment && (
        <TransferClassDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          enrollmentId={transferEnrollment.id}
          currentClassId={transferEnrollment.class_id}
          courseId={transferEnrollment.course_id}
          studentName={transferEnrollment.students?.student_number ?? "Étudiant"}
          currentClassName={transferEnrollment.classes?.name ?? "—"}
          onTransferred={fetch}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette inscription ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
