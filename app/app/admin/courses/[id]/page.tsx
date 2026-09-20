"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { CourseFormDialog, COURSE_STATUS_OPTIONS } from "@/components/academic/course-form-dialog";
import { ClassFormDialog } from "@/components/academic/class-form-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Pencil, Plus, MoreHorizontal, Trash2, Users, FileText } from "lucide-react";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  planned: { label: "Planifié", variant: "outline" },
  active: { label: "Ouvert", variant: "default" },
  completed: { label: "Terminé", variant: "secondary" },
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const { toast } = useToast();

  const [course, setCourse] = useState<(Course & { programs?: { name: string }, academic_years?: { name: string } }) | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canUpdate = permissions.includes("courses.update" as never);
  const canCreate = permissions.includes("classes.create" as never);
  const canDeleteClass = permissions.includes("classes.delete" as never);

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("courses")
      .select("*, programs(name), academic_years(name)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) { setCourse(null); return; }
    setCourse(data);
  }, [id]);

  const fetchClasses = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("course_id", id)
      .order("name", { ascending: true });
    if (error) return;
    setClasses(data ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCourse(), fetchClasses()]);
      setLoading(false);
    })();
  }, [fetchCourse, fetchClasses]);

  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("classes").delete().eq("id", deletingClass.id);
      if (error) throw error;
      toast({ title: "Classe supprimée" });
      setDeletingClass(null);
      fetchClasses();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Suppression impossible.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/courses")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><LoadingState /></div>;
  }

  if (!course) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/courses")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><EmptyState title="Cours introuvable" /></div>;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/courses")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
      </Button>

      <PageHeader
        title={course.name}
        description={`${course.programs?.name ?? "—"} — ${course.academic_years?.name ?? "—"}`}
        action={canUpdate && (
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Modifier
          </Button>
        )}
      />

      <div className="flex items-center gap-3 mb-6">
        <Badge variant={STATUS_BADGE[course.status]?.variant ?? "outline"}>{STATUS_BADGE[course.status]?.label ?? course.status}</Badge>
        <span className="text-sm text-muted-foreground">Frais: {course.tuition_fee.toLocaleString("fr-FR")} FCFA</span>
        {course.start_date && <span className="text-sm text-muted-foreground">Début: {new Date(course.start_date).toLocaleDateString("fr-FR")}</span>}
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes"><Users className="w-4 h-4 mr-2" /> Classes</TabsTrigger>
          <TabsTrigger value="info"><FileText className="w-4 h-4 mr-2" /> Informations</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Classes de ce cours</h3>
              {canCreate && (
                <Button size="sm" onClick={() => setClassFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une classe
                </Button>
              )}
            </div>
            {classes.length === 0 ? (
              <EmptyState title="Aucune classe" message="Créez des classes pour grouper les étudiants de ce cours." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>Salle</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/app/admin/classes/${c.id}`)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.capacity}</TableCell>
                        <TableCell className="text-muted-foreground">{c.room ?? "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canDeleteClass && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeletingClass(c)}>
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
        </TabsContent>

        <TabsContent value="info">
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div><p className="text-xs text-muted-foreground">Nom</p><p className="text-sm font-medium mt-0.5">{course.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Programme</p><p className="text-sm font-medium mt-0.5">{course.programs?.name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Année académique</p><p className="text-sm font-medium mt-0.5">{course.academic_years?.name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Statut</p><p className="text-sm font-medium mt-0.5">{STATUS_BADGE[course.status]?.label ?? course.status}</p></div>
              <div><p className="text-xs text-muted-foreground">Frais de formation</p><p className="text-sm font-medium mt-0.5">{course.tuition_fee.toLocaleString("fr-FR")} FCFA</p></div>
              <div><p className="text-xs text-muted-foreground">Frais d'inscription</p><p className="text-sm font-medium mt-0.5">{course.enrollment_fee.toLocaleString("fr-FR")} FCFA</p></div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <CourseFormDialog open={formOpen} onOpenChange={setFormOpen} course={course} onSaved={fetchCourse} />
      <ClassFormDialog open={classFormOpen} onOpenChange={setClassFormOpen} courseId={course.id} academicYearId={course.academic_year_id} onSaved={fetchClasses} />

      <AlertDialog open={!!deletingClass} onOpenChange={(o) => !o && setDeletingClass(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette classe ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClass} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
