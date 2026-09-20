"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { GraduationCap, Users, ClipboardCheck, Wallet, TrendingDown, Download, Award, BookOpen, ChartBar as BarChart3, Banknote, Clock, CircleAlert as AlertCircle } from "lucide-react";

type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatMoney(amount: number) {
  return `${Number(amount).toLocaleString("fr-FR")} FCFA`;
}

export default function ReportsPage() {
  const { permissions, profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");

  const canView = permissions.includes("reports.view" as never);

  useEffect(() => {
    if (profile?.institution_id) {
      supabase.from("academic_years").select("*").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => {
          setAcademicYears(data ?? []);
          if (data && data.length > 0) setSelectedYear(data[0].id);
        });
    }
  }, [profile?.institution_id]);

  const canViewStudents = permissions.includes("students.view" as never);
  const canViewEnrollments = permissions.includes("enrollments.view" as never);
  const canViewAttendance = permissions.includes("attendance.view" as never);
  const canViewGrades = permissions.includes("grades.view" as never);
  const canViewPayments = permissions.includes("payments.view" as never);
  const canViewExpenses = permissions.includes("expenses.view" as never);

  if (!canView) {
    return <div><PageHeader title="Rapports" /><Card className="p-6"><EmptyState title="Accès refusé" message="Vous n'avez pas la permission de consulter les rapports." /></Card></div>;
  }

  return (
    <div>
      <PageHeader title="Rapports" description="Statistiques et exports par formation, classe et année" />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Année académique :</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Sélectionner une année" /></SelectTrigger>
            <SelectContent>
              {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!selectedYear ? (
        <Card className="p-4"><EmptyState title="Sélectionnez une année" message="Choisissez une année académique pour générer les rapports." /></Card>
      ) : (
        <Tabs defaultValue="students">
          <TabsList className="flex-wrap">
            {canViewStudents && <TabsTrigger value="students"><GraduationCap className="w-4 h-4 mr-2" />Étudiants</TabsTrigger>}
            {canViewEnrollments && <TabsTrigger value="enrollments"><BookOpen className="w-4 h-4 mr-2" />Inscriptions</TabsTrigger>}
            {canViewAttendance && <TabsTrigger value="attendance"><ClipboardCheck className="w-4 h-4 mr-2" />Présences</TabsTrigger>}
            {canViewGrades && <TabsTrigger value="grades"><Award className="w-4 h-4 mr-2" />Résultats</TabsTrigger>}
            {canViewPayments && <TabsTrigger value="payments"><Wallet className="w-4 h-4 mr-2" />Paiements</TabsTrigger>}
            {canViewExpenses && <TabsTrigger value="expenses"><TrendingDown className="w-4 h-4 mr-2" />Dépenses</TabsTrigger>}
          </TabsList>

          {canViewStudents && (
            <TabsContent value="students">
              <StudentsReport institutionId={profile?.institution_id ?? ""} />
            </TabsContent>
          )}
          {canViewEnrollments && (
            <TabsContent value="enrollments">
              <EnrollmentsReport institutionId={profile?.institution_id ?? ""} academicYearId={selectedYear} />
            </TabsContent>
          )}
          {canViewAttendance && (
            <TabsContent value="attendance">
              <AttendanceReport academicYearId={selectedYear} />
            </TabsContent>
          )}
          {canViewGrades && (
            <TabsContent value="grades">
              <GradesReport institutionId={profile?.institution_id ?? ""} academicYearId={selectedYear} />
            </TabsContent>
          )}
          {canViewPayments && (
            <TabsContent value="payments">
              <PaymentsReport institutionId={profile?.institution_id ?? ""} academicYearId={selectedYear} />
            </TabsContent>
          )}
          {canViewExpenses && (
            <TabsContent value="expenses">
              <ExpensesReport institutionId={profile?.institution_id ?? ""} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

function StudentsReport({ institutionId }: { institutionId: string }) {
  const [stats, setStats] = useState({ total: 0, active: 0, graduated: 0, withdrawn: 0 });
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("students").select("status").eq("institution_id", institutionId);
        const all = data ?? [];
        const statusCounts: Record<string, number> = {};
        for (const s of all) { statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1; }
        setStats({
          total: all.length,
          active: statusCounts["active"] ?? 0,
          graduated: statusCounts["graduated"] ?? 0,
          withdrawn: statusCounts["withdrawn"] ?? 0,
        });
        setByStatus(Object.entries(statusCounts).map(([status, count]) => ({ status, count })));
      } catch {
        setStats({ total: 0, active: 0, graduated: 0, withdrawn: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [institutionId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total étudiants" value={stats.total} icon={GraduationCap} />
        <StatCard label="Actifs" value={stats.active} icon={Users} color="text-green-600" />
        <StatCard label="Diplômés" value={stats.graduated} icon={Award} color="text-blue-600" />
        <StatCard label="Retirés" value={stats.withdrawn} icon={Users} color="text-red-600" />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Répartition par statut</h3>
          {byStatus.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `etudiants_statut_${new Date().toISOString().split("T")[0]}.csv`,
              ["Statut", "Nombre"], byStatus.map((r) => [r.status, r.count])
            )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          )}
        </div>
        {byStatus.length === 0 ? <EmptyState title="Aucune donnée" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Statut</TableHead><TableHead className="text-right">Nombre</TableHead></TableRow></TableHeader>
            <TableBody>
              {byStatus.map((r) => (
                <TableRow key={r.status}><TableCell className="font-medium capitalize">{r.status}</TableCell><TableCell className="text-right font-bold">{r.count}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EnrollmentsReport({ institutionId, academicYearId }: { institutionId: string; academicYearId: string }) {
  const [byCourse, setByCourse] = useState<{ courseName: string; count: number; active: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, active: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const studentIds = (await supabase.from("students").select("id").eq("institution_id", institutionId)).data?.map((r: { id: string }) => r.id) ?? [];
        if (studentIds.length === 0) { setByCourse([]); return; }
        const { data } = await supabase
          .from("enrollments")
          .select("status, courses(name)")
          .in("student_id", studentIds)
          .eq("academic_year_id", academicYearId);

        const courseMap: Record<string, { count: number; active: number }> = {};
        for (const e of data ?? []) {
          const name = (e as unknown as { courses: { name: string } }).courses?.name ?? "Inconnu";
          if (!courseMap[name]) courseMap[name] = { count: 0, active: 0 };
          courseMap[name].count++;
          if (e.status === "active") courseMap[name].active++;
        }
        const result = Object.entries(courseMap).map(([courseName, v]) => ({ courseName, ...v }));
        setByCourse(result.sort((a, b) => b.count - a.count));
        setTotals({ total: result.reduce((s, r) => s + r.count, 0), active: result.reduce((s, r) => s + r.active, 0) });
      } catch { setByCourse([]); } finally { setLoading(false); }
    })();
  }, [institutionId, academicYearId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total inscriptions" value={totals.total} icon={BookOpen} />
        <StatCard label="Inscriptions actives" value={totals.active} icon={ClipboardCheck} color="text-green-600" />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Inscriptions par formation</h3>
          {byCourse.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `inscriptions_${new Date().toISOString().split("T")[0]}.csv`,
              ["Formation", "Total", "Actives"], byCourse.map((r) => [r.courseName, r.count, r.active])
            )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          )}
        </div>
        {byCourse.length === 0 ? <EmptyState title="Aucune inscription" message="Aucune inscription pour cette année académique." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Formation</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actives</TableHead></TableRow></TableHeader>
            <TableBody>
              {byCourse.map((r) => (
                <TableRow key={r.courseName}><TableCell className="font-medium">{r.courseName}</TableCell><TableCell className="text-right font-bold">{r.count}</TableCell><TableCell className="text-right text-green-600">{r.active}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function AttendanceReport({ academicYearId }: { academicYearId: string }) {
  const [stats, setStats] = useState<Record<string, number>>({ present: 0, absent: 0, late: 0, excused: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("attendance").select("status").eq("academic_year_id", academicYearId);
        const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
        for (const a of data ?? []) { counts[a.status] = (counts[a.status] ?? 0) + 1; }
        setStats(counts);
      } catch { setStats({ present: 0, absent: 0, late: 0, excused: 0 }); } finally { setLoading(false); }
    })();
  }, [academicYearId]);

  if (loading) return <LoadingState />;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Présents" value={stats.present} icon={ClipboardCheck} color="text-green-600" />
        <StatCard label="Absents" value={stats.absent} icon={ClipboardCheck} color="text-red-600" />
        <StatCard label="Retards" value={stats.late} icon={ClipboardCheck} color="text-amber-600" />
        <StatCard label="Excusés" value={stats.excused} icon={ClipboardCheck} color="text-blue-600" />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Répartition des présences</h3>
          {total > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `presences_${new Date().toISOString().split("T")[0]}.csv`,
              ["Statut", "Nombre", "Pourcentage"],
              Object.entries(stats).map(([k, v]) => [k, v, total > 0 ? `${Math.round((v / total) * 100)}%` : "0%"])
            )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          )}
        </div>
        {total === 0 ? <EmptyState title="Aucune donnée" message="Aucune présence enregistrée pour cette année." /> : (
          <div className="space-y-2">
            {Object.entries(stats).map(([status, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const colors: Record<string, string> = { present: "bg-green-500", absent: "bg-red-500", late: "bg-amber-500", excused: "bg-blue-500" };
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20 capitalize">{status}</span>
                  <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${colors[status] ?? "bg-primary"} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-bold w-12 text-right">{count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function GradesReport({ institutionId, academicYearId }: { institutionId: string; academicYearId: string }) {
  const [byAssessment, setByAssessment] = useState<{ title: string; className: string; avg: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const classIds = (await supabase.from("classes").select("id").eq("institution_id", institutionId)).data?.map((r: { id: string }) => r.id) ?? [];
        if (classIds.length === 0) { setByAssessment([]); return; }
        const { data: assessments } = await supabase
          .from("assessments")
          .select("id, title, max_score, classes(name)")
          .in("class_id", classIds)
          .eq("academic_year_id", academicYearId)
          .in("status", ["published", "validated"]);
        if (!assessments || assessments.length === 0) { setByAssessment([]); return; }

        const assessmentIds = assessments.map((a) => a.id);
        const { data: grades } = await supabase
          .from("grades")
          .select("assessment_id, score")
          .in("assessment_id", assessmentIds)
          .in("status", ["submitted", "validated"]);

        const gradesByAssessment: Record<string, number[]> = {};
        for (const g of grades ?? []) {
          if (!gradesByAssessment[g.assessment_id]) gradesByAssessment[g.assessment_id] = [];
          gradesByAssessment[g.assessment_id].push(Number(g.score));
        }

        const result = assessments.map((a) => {
          const scores = gradesByAssessment[a.id] ?? [];
          const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length / a.max_score * 20 : 0;
          return {
            title: a.title,
            className: (a as unknown as { classes: { name: string } }).classes?.name ?? "—",
            avg, count: scores.length,
          };
        });
        setByAssessment(result.filter((r) => r.count > 0));
      } catch { setByAssessment([]); } finally { setLoading(false); }
    })();
  }, [institutionId, academicYearId]);

  if (loading) return <LoadingState />;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Moyennes par évaluation</h3>
        {byAssessment.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => exportCSV(
            `resultats_${new Date().toISOString().split("T")[0]}.csv`,
            ["Évaluation", "Classe", "Moyenne /20", "Étudiants"],
            byAssessment.map((r) => [r.title, r.className, r.avg.toFixed(2), r.count])
          )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        )}
      </div>
      {byAssessment.length === 0 ? <EmptyState title="Aucune donnée" message="Aucune note publiée pour cette année." /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Évaluation</TableHead><TableHead>Classe</TableHead><TableHead className="text-right">Moyenne /20</TableHead><TableHead className="text-right">Étudiants</TableHead></TableRow></TableHeader>
          <TableBody>
            {byAssessment.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-muted-foreground">{r.className}</TableCell>
                <TableCell className="text-right"><Badge variant={r.avg >= 10 ? "default" : "destructive"}>{r.avg.toFixed(2)}</Badge></TableCell>
                <TableCell className="text-right text-muted-foreground">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function PaymentsReport({ institutionId, academicYearId }: { institutionId: string; academicYearId: string }) {
  const [stats, setStats] = useState({ totalDue: 0, totalPaid: 0, totalRemaining: 0, planCount: 0 });
  const [byMethod, setByMethod] = useState<{ method: string; count: number; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: plans } = await supabase
          .from("payment_plans")
          .select("id, total_amount")
          .eq("institution_id", institutionId)
          .eq("academic_year_id", academicYearId);
        const planIds = (plans ?? []).map((p) => p.id);
        if (planIds.length === 0) { setStats({ totalDue: 0, totalPaid: 0, totalRemaining: 0, planCount: 0 }); setByMethod([]); return; }

        const { data: installments } = await supabase
          .from("installments")
          .select("id, amount_due, amount_paid")
          .in("payment_plan_id", planIds);
        const totalDue = (installments ?? []).reduce((s, i) => s + Number(i.amount_due), 0);
        const totalPaid = (installments ?? []).reduce((s, i) => s + Number(i.amount_paid), 0);
        setStats({ totalDue, totalPaid, totalRemaining: totalDue - totalPaid, planCount: plans?.length ?? 0 });

        const instIds = (installments ?? []).map((i) => i.id);
        if (instIds.length > 0) {
          const { data: payments } = await supabase
            .from("payments")
            .select("method, amount")
            .in("installment_id", instIds)
            .eq("status", "completed");
          const methodMap: Record<string, { count: number; amount: number }> = {};
          for (const p of payments ?? []) {
            if (!methodMap[p.method]) methodMap[p.method] = { count: 0, amount: 0 };
            methodMap[p.method].count++;
            methodMap[p.method].amount += Number(p.amount);
          }
          setByMethod(Object.entries(methodMap).map(([method, v]) => ({ method, ...v })));
        } else { setByMethod([]); }
      } catch { setStats({ totalDue: 0, totalPaid: 0, totalRemaining: 0, planCount: 0 }); } finally { setLoading(false); }
    })();
  }, [institutionId, academicYearId]);

  if (loading) return <LoadingState />;
  const METHOD_LABELS: Record<string, string> = { cash: "Espèces", bank_transfer: "Virement", wave: "Wave", orange_money: "Orange Money", other: "Autre" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total facturé" value={formatMoney(stats.totalDue)} icon={Wallet} />
        <StatCard label="Total encaissé" value={formatMoney(stats.totalPaid)} icon={Banknote} color="text-green-600" />
        <StatCard label="Reste à payer" value={formatMoney(stats.totalRemaining)} icon={Clock} color="text-orange-600" />
        <StatCard label="Échéanciers" value={stats.planCount} icon={BarChart3} />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Paiements par méthode</h3>
          {byMethod.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `paiements_${new Date().toISOString().split("T")[0]}.csv`,
              ["Méthode", "Nombre", "Montant"], byMethod.map((r) => [METHOD_LABELS[r.method] ?? r.method, r.count, r.amount])
            )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          )}
        </div>
        {byMethod.length === 0 ? <EmptyState title="Aucun paiement" message="Aucun paiement enregistré pour cette année." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Méthode</TableHead><TableHead className="text-right">Nombre</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
            <TableBody>
              {byMethod.map((r) => (
                <TableRow key={r.method}><TableCell className="font-medium">{METHOD_LABELS[r.method] ?? r.method}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right font-bold">{formatMoney(r.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ExpensesReport({ institutionId }: { institutionId: string }) {
  const [byCategory, setByCategory] = useState<{ category: string; count: number; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from("expenses").select("category, amount").eq("institution_id", institutionId).order("expense_date", { ascending: false });
        const catMap: Record<string, { count: number; amount: number }> = {};
        for (const e of data ?? []) {
          if (!catMap[e.category]) catMap[e.category] = { count: 0, amount: 0 };
          catMap[e.category].count++;
          catMap[e.category].amount += Number(e.amount);
        }
        const result = Object.entries(catMap).map(([category, v]) => ({ category, ...v }));
        setByCategory(result.sort((a, b) => b.amount - a.amount));
        setTotal(result.reduce((s, r) => s + r.amount, 0));
      } catch { setByCategory([]); } finally { setLoading(false); }
    })();
  }, [institutionId]);

  if (loading) return <LoadingState />;
  const CATEGORY_LABELS: Record<string, string> = {
    salaires: "Salaires", loyer: "Loyer", fournitures: "Fournitures", maintenance: "Maintenance",
    marketing: "Marketing", transport: "Transport", services: "Services", autres: "Autres",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total dépenses" value={formatMoney(total)} icon={TrendingDown} color="text-red-600" />
        <StatCard label="Catégories" value={byCategory.length} icon={BarChart3} />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Dépenses par catégorie</h3>
          {byCategory.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(
              `depenses_${new Date().toISOString().split("T")[0]}.csv`,
              ["Catégorie", "Nombre", "Montant"], byCategory.map((r) => [CATEGORY_LABELS[r.category] ?? r.category, r.count, r.amount])
            )}><Download className="w-4 h-4 mr-2" /> CSV</Button>
          )}
        </div>
        {byCategory.length === 0 ? <EmptyState title="Aucune dépense" message="Aucune dépense enregistrée." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Catégorie</TableHead><TableHead className="text-right">Nombre</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Part</TableHead></TableRow></TableHeader>
            <TableBody>
              {byCategory.map((r) => (
                <TableRow key={r.category}>
                  <TableCell className="font-medium">{CATEGORY_LABELS[r.category] ?? r.category}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right font-bold">{formatMoney(r.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{total > 0 ? `${Math.round((r.amount / total) * 100)}%` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
