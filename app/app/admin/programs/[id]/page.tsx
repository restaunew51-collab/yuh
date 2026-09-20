"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ProgramFormDialog } from "@/components/academic/program-form-dialog";
import { ModuleFormDialog } from "@/components/academic/module-form-dialog";
import { SubjectFormDialog } from "@/components/academic/subject-form-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ArrowLeft, Pencil, Plus, ChevronDown, MoreHorizontal, Trash2, BookOpen, Layers, FileText,
} from "lucide-react";

type Program = Database["public"]["Tables"]["programs"]["Row"];
type Module = Database["public"]["Tables"]["modules"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const { toast } = useToast();

  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, Subject[]>>({});
  const [loading, setLoading] = useState(true);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const [programFormOpen, setProgramFormOpen] = useState(false);
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectModuleId, setSubjectModuleId] = useState<string>("");
  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canUpdate = permissions.includes("programs.update" as never);
  const canCreate = permissions.includes("programs.create" as never);
  const canDelete = permissions.includes("programs.delete" as never);

  const fetchProgram = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
    if (error || !data) { setProgram(null); return; }
    setProgram(data);
  }, [id]);

  const fetchModules = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("program_id", id)
      .order("semester", { ascending: true })
      .order("order_index", { ascending: true });
    if (error) return;
    setModules(data ?? []);
  }, [id]);

  const fetchSubjects = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("subjects")
      .select("*, module_id")
      .in("module_id", modules.map((m) => m.id));
    if (error) return;
    const map: Record<string, Subject[]> = {};
    for (const s of data ?? []) {
      if (!map[s.module_id]) map[s.module_id] = [];
      map[s.module_id].push(s);
    }
    setSubjectsMap(map);
  }, [id, modules]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchProgram();
      await fetchModules();
      setLoading(false);
    })();
  }, [fetchProgram, fetchModules]);

  useEffect(() => {
    if (modules.length > 0) fetchSubjects();
  }, [fetchSubjects]);

  const handleDeleteModule = async () => {
    if (!deletingModule) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("modules").delete().eq("id", deletingModule.id);
      if (error) throw error;
      toast({ title: "Module supprimé" });
      setDeletingModule(null);
      fetchModules();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("subjects").delete().eq("id", deletingSubject.id);
      if (error) throw error;
      toast({ title: "Matière supprimée" });
      setDeletingSubject(null);
      fetchSubjects();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/programs")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
        <LoadingState />
      </div>
    );
  }

  if (!program) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/programs")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
        <EmptyState title="Formation introuvable" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/programs")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
      </Button>

      <PageHeader
        title={program.name}
        description={`Code: ${program.code} — ${program.duration_years} an${program.duration_years > 1 ? "s" : ""}`}
        action={canUpdate && (
          <Button variant="outline" onClick={() => setProgramFormOpen(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Modifier
          </Button>
        )}
      />

      <div className="flex items-center gap-3 mb-6">
        {program.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
        {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">
            <Layers className="w-4 h-4 mr-2" /> Modules & Matières
          </TabsTrigger>
          <TabsTrigger value="info">
            <FileText className="w-4 h-4 mr-2" /> Informations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Modules du programme</h3>
              {canCreate && (
                <Button size="sm" onClick={() => { setEditingModule(null); setModuleFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter un module
                </Button>
              )}
            </div>

            {modules.length === 0 ? (
              <EmptyState title="Aucun module" message="Ajoutez des modules pour structurer le curriculum." />
            ) : (
              <div className="space-y-3">
                {modules.map((m) => (
                  <Collapsible
                    key={m.id}
                    open={openModules[m.id] ?? false}
                    onOpenChange={(o) => setOpenModules({ ...openModules, [m.id]: o })}
                  >
                    <Card className="p-0">
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openModules[m.id] ? "rotate-180" : ""}`} />
                          <div>
                            <p className="text-sm font-medium">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.code} — Semestre {m.semester}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{(subjectsMap[m.id] ?? []).length} matière{(subjectsMap[m.id] ?? []).length > 1 ? "s" : ""}</Badge>
                          {canUpdate && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingModule(m); setModuleFormOpen(true); }}>
                                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSubjectModuleId(m.id); setEditingSubject(null); setSubjectFormOpen(true); }}>
                                  <Plus className="w-4 h-4 mr-2" /> Ajouter une matière
                                </DropdownMenuItem>
                                {canDelete && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeletingModule(m)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-3">
                          {(subjectsMap[m.id] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Aucune matière dans ce module.</p>
                          ) : (
                            <div className="space-y-2">
                              {(subjectsMap[m.id] ?? []).map((s) => (
                                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                  <div>
                                    <p className="text-sm font-medium">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">{s.code} — {s.hours_planned}h — Coef. {s.coefficient}</p>
                                  </div>
                                  {canUpdate && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setSubjectModuleId(m.id); setEditingSubject(s); setSubjectFormOpen(true); }}>
                                          <Pencil className="w-4 h-4 mr-2" /> Modifier
                                        </DropdownMenuItem>
                                        {canDelete && (
                                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingSubject(s)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div><p className="text-xs text-muted-foreground">Nom</p><p className="text-sm font-medium mt-0.5">{program.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Code</p><p className="text-sm font-medium mt-0.5">{program.code}</p></div>
              <div><p className="text-xs text-muted-foreground">Durée</p><p className="text-sm font-medium mt-0.5">{program.duration_years} an{program.duration_years > 1 ? "s" : ""}</p></div>
              <div><p className="text-xs text-muted-foreground">Statut</p><p className="text-sm font-medium mt-0.5">{program.is_active ? "Active" : "Inactive"}</p></div>
              {program.description && <div className="col-span-2"><p className="text-xs text-muted-foreground">Description</p><p className="text-sm font-medium mt-0.5">{program.description}</p></div>}
              {program.admission_requirements && <div className="col-span-2"><p className="text-xs text-muted-foreground">Prérequis</p><p className="text-sm font-medium mt-0.5">{program.admission_requirements}</p></div>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ProgramFormDialog open={programFormOpen} onOpenChange={setProgramFormOpen} program={program} onSaved={fetchProgram} />
      <ModuleFormDialog open={moduleFormOpen} onOpenChange={setModuleFormOpen} module={editingModule} programId={program.id} onSaved={fetchModules} />
      {subjectModuleId && (
        <SubjectFormDialog open={subjectFormOpen} onOpenChange={setSubjectFormOpen} subject={editingSubject} moduleId={subjectModuleId} onSaved={fetchSubjects} />
      )}

      <AlertDialog open={!!deletingModule} onOpenChange={(o) => !o && setDeletingModule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce module ?</AlertDialogTitle>
            <AlertDialogDescription>Cela supprimera aussi les matières associées. Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModule} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingSubject} onOpenChange={(o) => !o && setDeletingSubject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette matière ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubject} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
