"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TermFormDialog } from "@/components/academic/term-form-dialog";
import { Button } from "@/components/ui/button";
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
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

type Term = Database["public"]["Tables"]["terms"]["Row"];
type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

export default function TermsPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState<Term | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManage = permissions.includes("settings.manage" as never);
  const canView = permissions.includes("settings.view" as never) || canManage;

  const fetchAcademicYears = useCallback(async () => {
    if (!profile?.institution_id) return;
    const { data } = await supabase
      .from("academic_years")
      .select("*")
      .eq("institution_id", profile.institution_id)
      .order("start_date", { ascending: false });
    setAcademicYears(data ?? []);
  }, [profile?.institution_id]);

  const fetchTerms = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("terms")
        .select("*, academic_years!inner(name)")
        .in("academic_year_id",
          (await supabase.from("academic_years").select("id").eq("institution_id", profile.institution_id)).data?.map((r: { id: string }) => r.id) ?? []);

      if (selectedYear !== "all") {
        query = query.eq("academic_year_id", selectedYear);
      }

      const { data, error } = await query.order("start_date", { ascending: true });
      if (error) throw error;
      setTerms(data ?? []);
    } catch {
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, selectedYear]);

  useEffect(() => { fetchAcademicYears(); }, [fetchAcademicYears]);
  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("terms").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Période supprimée" });
      setDeleting(null);
      fetchTerms();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!canView) {
    return <div><PageHeader title="Périodes académiques" /><Card className="p-6"><EmptyState title="Accès refusé" /></Card></div>;
  }

  if (loading && academicYears.length === 0) {
    return <div><PageHeader title="Périodes académiques" description="Gestion des semestres et trimestres" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Périodes académiques"
        description="Semestres, trimestres et périodes des années académiques"
        action={canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle période
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex gap-3 mb-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Toutes les années" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {academicYears.map((ay) => (
                <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {terms.length === 0 ? (
          <EmptyState title="Aucune période" message="Créez des périodes pour structurer votre année académique." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Année académique</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(t as unknown as { academic_years: { name: string } }).academic_years?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(t.start_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(t.end_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(t); setFormOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(t)}>
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
        )}
      </Card>

      <TermFormDialog open={formOpen} onOpenChange={setFormOpen} term={editing} academicYears={academicYears} onSaved={fetchTerms} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette période ?</AlertDialogTitle>
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
