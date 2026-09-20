"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { EXPENSE_CATEGORY_OPTIONS } from "@/components/shared/status-badge";
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
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Receipt, TrendingDown, ChevronLeft, ChevronRight,
} from "lucide-react";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];

const PAGE_SIZE = 10;

function formatMoney(amount: number, currency: string) {
  return `${Number(amount).toLocaleString("fr-FR")} ${currency === "EUR" ? "€" : "FCFA"}`;
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORY_OPTIONS.map((c) => [c.value, c.label])
);

export default function ExpensesPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [totalExpenses, setTotalExpenses] = useState(0);

  const canCreate = permissions.includes("expenses.create" as never);
  const canUpdate = permissions.includes("expenses.update" as never);
  const canDelete = permissions.includes("expenses.delete" as never);

  const fetchExpenses = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("expenses")
        .select("*", { count: "exact" })
        .eq("institution_id", profile.institution_id);

      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (search.trim()) query = query.ilike("description", `%${search.trim()}%`);
      query = query.order("expense_date", { ascending: false });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;
      setItems(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, categoryFilter, search, page]);

  const fetchStats = useCallback(async () => {
    if (!profile?.institution_id) return;
    try {
      const { data } = await supabase
        .from("expenses")
        .select("amount, currency")
        .eq("institution_id", profile.institution_id);
      const total = (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
      setTotalExpenses(total);
    } catch { /* ignore */ }
  }, [profile?.institution_id]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error: deleteError } = await supabase.from("expenses").delete().eq("id", deleting.id);
      if (deleteError) throw deleteError;
      toast({ title: "Dépense supprimée" });
      setDeleting(null);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && items.length === 0) {
    return (
      <div>
        <PageHeader title="Dépenses" description="Gestion des dépenses de l'établissement" />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Dépenses" description="Gestion des dépenses de l'établissement" />
        <ErrorState message={error} action={<Button variant="outline" size="sm" onClick={fetchExpenses}>Réessayer</Button>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dépenses"
        description="Gestion des dépenses de l'établissement"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle dépense
          </Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total des dépenses" value={formatMoney(totalExpenses, "XOF")} icon={TrendingDown} color="text-red-600" />
        <StatCard label="Nombre de dépenses" value={totalCount} icon={Receipt} color="text-primary" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Aucune dépense"
            message="Enregistrez une dépense pour suivre les sorties financières."
            action={canCreate && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Badge variant="secondary">{CATEGORY_LABELS[e.category] ?? e.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.description ?? "—"}</TableCell>
                      <TableCell className="font-medium">{formatMoney(e.amount, e.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(e.expense_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => { setEditing(e); setFormOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Modifier
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
                <p className="text-sm text-muted-foreground">{totalCount} dépense{totalCount > 1 ? "s" : ""} au total</p>
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

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} onSaved={() => { fetchExpenses(); fetchStats(); }} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
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
