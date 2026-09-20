"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { CourseFormDialog, COURSE_STATUS_OPTIONS } from "@/components/academic/course-form-dialog";
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
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";

type Course = Database["public"]["Tables"]["courses"]["Row"];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planifié", variant: "outline" },
  active: { label: "Ouvert", variant: "default" },
  completed: { label: "Terminé", variant: "secondary" },
};

const PAGE_SIZE = 10;

export default function CoursesPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<(Course & { programs?: { name: string }, academic_years?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = permissions.includes("courses.create" as never);
  const canUpdate = permissions.includes("courses.update" as never);
  const canDelete = permissions.includes("courses.delete" as never);

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("courses")
        .select("*, programs(name), academic_years(name)", { count: "exact" })
        .eq("institution_id", profile.institution_id);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      query = query.order("created_at", { ascending: false });
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
  }, [profile?.institution_id, statusFilter, search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("courses").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Cours supprimé" });
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
    return <div><PageHeader title="Cours" description="Offre de formations par année académique" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Cours"
        description="Offre de formations ouvertes par année académique"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau cours
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {COURSE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Aucun cours" message="Créez une offre de formation pour une année académique." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Année académique</TableHead>
                    <TableHead>Frais</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/app/admin/courses/${c.id}`)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.programs?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.academic_years?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.tuition_fee.toLocaleString("fr-FR")} FCFA</TableCell>
                      <TableCell><Badge variant={STATUS_BADGE[c.status]?.variant ?? "outline"}>{STATUS_BADGE[c.status]?.label ?? c.status}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/app/admin/courses/${c.id}`)}>
                              <Eye className="w-4 h-4 mr-2" /> Voir le détail
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => { setEditing(c); setFormOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Modifier
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(c)}>
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
                <p className="text-sm text-muted-foreground">{totalCount} cours au total</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
                  <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Suivant</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <CourseFormDialog open={formOpen} onOpenChange={setFormOpen} course={editing} onSaved={fetch} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cours ?</AlertDialogTitle>
            <AlertDialogDescription>Cela supprimera aussi les classes associées. Cette action est irréversible.</AlertDialogDescription>
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
