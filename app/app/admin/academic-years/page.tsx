"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AcademicYearFormDialog } from "@/components/academic/academic-year-form-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, MoreHorizontal, Pencil, Trash2, Calendar } from "lucide-react";

type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

export default function AcademicYearsPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [deleting, setDeleting] = useState<AcademicYear | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManage = permissions.includes("settings.manage" as never);
  const canView = permissions.includes("settings.view" as never) || canManage;

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("institution_id", profile.institution_id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("academic_years").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Année académique supprimée" });
      setDeleting(null);
      fetch();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!canView) {
    return (
      <div>
        <PageHeader title="Années académiques" />
        <Card className="p-6"><EmptyState title="Accès refusé" message="Vous n'avez pas la permission d'accéder à cette section." /></Card>
      </div>
    );
  }

  if (loading) {
    return <div><PageHeader title="Années académiques" description="Gestion des années académiques" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Années académiques"
        description="Gestion des années et périodes académiques"
        action={canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle année
          </Button>
        )}
      />

      <Card className="p-4">
        {items.length === 0 ? (
          <EmptyState title="Aucune année académique" message="Créez votre première année académique." action={canManage && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ay) => (
                  <TableRow key={ay.id}>
                    <TableCell className="font-medium">{ay.name}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(ay.start_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(ay.end_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{ay.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(ay); setFormOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(ay)}>
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

      <AcademicYearFormDialog open={formOpen} onOpenChange={setFormOpen} academicYear={editing} onSaved={fetch} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette année académique ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible et peut affecter les cours et classes associés.</AlertDialogDescription>
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
