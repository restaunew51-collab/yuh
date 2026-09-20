"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ProgramFormDialog } from "@/components/academic/program-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";

type Program = Database["public"]["Tables"]["programs"]["Row"];

export default function ProgramsPage() {
  const { permissions, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = permissions.includes("programs.create" as never);
  const canUpdate = permissions.includes("programs.update" as never);
  const canDelete = permissions.includes("programs.delete" as never);

  const fetch = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("programs")
        .select("*")
        .eq("institution_id", profile.institution_id);
      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,code.ilike.%${search.trim}%`);
      }
      query = query.order("name", { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("programs").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Formation supprimée" });
      setDeleting(null);
      fetch();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && items.length === 0) {
    return <div><PageHeader title="Formations" description="Programmes et cursus académiques" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Formations"
        description="Programmes et cursus académiques"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle formation
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom ou code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {items.length === 0 ? (
          <EmptyState title="Aucune formation" message="Créez votre premier programme de formation." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/app/admin/programs/${p.id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.code}</TableCell>
                    <TableCell className="text-muted-foreground">{p.duration_years} an{p.duration_years > 1 ? "s" : ""}</TableCell>
                    <TableCell>{p.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/app/admin/programs/${p.id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> Voir le détail
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => { setEditing(p); setFormOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(p)}>
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

      <ProgramFormDialog open={formOpen} onOpenChange={setFormOpen} program={editing} onSaved={fetch} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette formation ?</AlertDialogTitle>
            <AlertDialogDescription>Cela supprimera aussi les modules et matières associés. Cette action est irréversible.</AlertDialogDescription>
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
