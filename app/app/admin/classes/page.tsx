"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { Search, MoreHorizontal, Eye, Trash2 } from "lucide-react";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

const PAGE_SIZE = 10;

export default function ClassesPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<(ClassRow & { courses?: { name: string }, academic_years?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canDelete = permissions.includes("classes.delete" as never);

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("classes")
        .select("*, courses(name), academic_years(name)", { count: "exact" })
        .eq("institution_id", profile.institution_id);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      query = query.order("name", { ascending: true });
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
  }, [profile?.institution_id, search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("classes").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Classe supprimée" });
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
    return <div><PageHeader title="Classes" description="Groupes d'étudiants par cours" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Classes" description="Groupes d'étudiants par cours" />

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>

        {items.length === 0 ? (
          <EmptyState title="Aucune classe" message="Les classes sont créées depuis le détail d'un cours." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Cours</TableHead>
                    <TableHead>Année académique</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Salle</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/app/admin/classes/${c.id}`)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.courses?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.academic_years?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.capacity}</TableCell>
                      <TableCell className="text-muted-foreground">{c.room ?? "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canDelete && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/app/admin/classes/${c.id}`)}>
                                <Eye className="w-4 h-4 mr-2" /> Voir le détail
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(c)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{totalCount} classes au total</p>
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette classe ?</AlertDialogTitle>
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
