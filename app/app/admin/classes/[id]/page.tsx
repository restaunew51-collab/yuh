"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ClassFormDialog } from "@/components/academic/class-form-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Pencil, Users, Calendar, ClipboardCheck, Award, Wallet, FileText,
} from "lucide-react";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

type EnrollmentWithStudent = Enrollment & {
  students?: { student_number: string };
};

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { permissions } = useAuth();
  const [classItem, setClassItem] = useState<(ClassRow & { courses?: { name: string }, academic_years?: { name: string } }) | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const canUpdate = permissions.includes("classes.update" as never);

  const fetchClass = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("classes")
      .select("*, courses(name), academic_years(name)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) { setClassItem(null); return; }
    setClassItem(data);
  }, [id]);

  const fetchEnrollments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("enrollments")
      .select("*, students(student_number)")
      .eq("class_id", id)
      .order("enrollment_date", { ascending: false });
    setEnrollments(data ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchClass(), fetchEnrollments()]);
      setLoading(false);
    })();
  }, [fetchClass, fetchEnrollments]);

  if (loading) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/classes")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><LoadingState /></div>;
  }

  if (!classItem) {
    return <div><Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/classes")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button><EmptyState title="Classe introuvable" /></div>;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/admin/classes")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
      </Button>

      <PageHeader
        title={classItem.name}
        description={`${classItem.courses?.name ?? "—"} — ${classItem.academic_years?.name ?? "—"}`}
        action={canUpdate && (
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Modifier
          </Button>
        )}
      />

      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-muted-foreground">Capacité: {classItem.capacity}</span>
        <span className="text-sm text-muted-foreground">Salle: {classItem.room ?? "—"}</span>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="flex-wrap">
          <TabsTrigger value="students"><Users className="w-4 h-4 mr-2" /> Étudiants</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="w-4 h-4 mr-2" /> Planning</TabsTrigger>
          <TabsTrigger value="attendance"><ClipboardCheck className="w-4 h-4 mr-2" /> Présences</TabsTrigger>
          <TabsTrigger value="grades"><Award className="w-4 h-4 mr-2" /> Notes</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="w-4 h-4 mr-2" /> Paiements</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-2" /> Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="p-4">
            {enrollments.length === 0 ? (
              <EmptyState title="Aucun étudiant" message="Aucun étudiant n'est inscrit dans cette classe pour le moment." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date d'inscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((e) => (
                      <TableRow
                        key={e.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/app/admin/enrollments/${e.id}`)}
                      >
                        <TableCell className="font-medium">{e.students?.student_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "active" ? "default" : "outline"}>
                            {e.status === "active" ? "Active" : e.status === "pending" ? "En attente" : e.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(e.enrollment_date).toLocaleDateString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-3">
              <EmptyState title="Planning de la classe" message="Gérez l'emploi du temps de cette classe." />
              <Button onClick={() => router.push(`/app/admin/schedules`)}>
                <Calendar className="w-4 h-4 mr-2" /> Aller au planning
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="attendance">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-3">
              <EmptyState title="Présences de la classe" message="Faites l'appel et consultez l'historique." />
              <Button onClick={() => router.push(`/app/admin/attendance`)}>
                <ClipboardCheck className="w-4 h-4 mr-2" /> Gérer les présences
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="grades">
          <Card className="p-6">
            <div className="flex flex-col items-center gap-3">
              <EmptyState title="Notes et bulletins" message="Créez des évaluations et générez les bulletins." />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/app/admin/grades`)}>
                  <Award className="w-4 h-4 mr-2" /> Évaluations
                </Button>
                <Button variant="outline" onClick={() => router.push(`/app/admin/bulletins`)}>
                  <FileText className="w-4 h-4 mr-2" /> Bulletins
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="p-6"><EmptyState title="Module à venir" message="La gestion des paiements sera disponible dans un prochain module." /></Card>
        </TabsContent>
        <TabsContent value="documents">
          <Card className="p-6"><EmptyState title="Module à venir" message="La gestion des documents sera disponible dans un prochain module." /></Card>
        </TabsContent>
      </Tabs>

      <ClassFormDialog open={formOpen} onOpenChange={setFormOpen} classItem={classItem} onSaved={fetchClass} />
    </div>
  );
}
