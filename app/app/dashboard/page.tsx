"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { GraduationCap, UserPlus, BookOpen, Users, ClipboardCheck, Award, Wallet, CircleAlert as AlertCircle, CalendarDays, TrendingUp, TrendingDown, Banknote, Clock } from "lucide-react";

interface DashboardStats {
  totalStudents: number;
  newApplicants: number;
  reviewingApplicants: number;
  admittedApplicants: number;
  activeStudents: number;
  activeEnrollments: number;
  totalEnrollments: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalExpenses: number;
  planCount: number;
}

function formatMoney(amount: number) {
  return `${Number(amount).toLocaleString("fr-FR")} FCFA`;
}

export default function DashboardPage() {
  const { profile, roles, permissions } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const displayName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "Utilisateur";

  const primaryRole = roles[0]?.replace(/_/g, " ") ?? "utilisateur";

  useEffect(() => {
    async function fetchStats() {
      if (!profile?.institution_id) { setLoadingStats(false); return; }
      try {
        const canViewStudents = permissions.includes("students.view" as never);
        const canViewApplicants = permissions.includes("applicants.view" as never);
        const canViewEnrollments = permissions.includes("enrollments.view" as never);
        const canViewPayments = permissions.includes("payments.view" as never);
        const canViewExpenses = permissions.includes("expenses.view" as never);

        const statsMap: Record<string, number> = {};

        if (canViewStudents) {
          const [totalRes, activeRes] = await Promise.all([
            supabase.from("students").select("*", { count: "exact", head: true }).eq("institution_id", profile.institution_id),
            supabase.from("students").select("*", { count: "exact", head: true }).eq("institution_id", profile.institution_id).eq("status", "active"),
          ]);
          statsMap.totalStudents = totalRes.count ?? 0;
          statsMap.activeStudents = activeRes.count ?? 0;
        }

        if (canViewApplicants) {
          const [newRes, reviewingRes, admittedRes] = await Promise.all([
            supabase.from("applicants").select("*", { count: "exact", head: true }).eq("institution_id", profile.institution_id).eq("status", "new"),
            supabase.from("applicants").select("*", { count: "exact", head: true }).eq("institution_id", profile.institution_id).eq("status", "reviewing"),
            supabase.from("applicants").select("*", { count: "exact", head: true }).eq("institution_id", profile.institution_id).eq("status", "admitted"),
          ]);
          statsMap.newApplicants = newRes.count ?? 0;
          statsMap.reviewingApplicants = reviewingRes.count ?? 0;
          statsMap.admittedApplicants = admittedRes.count ?? 0;
        }

        if (canViewEnrollments) {
          const studentIds = (await supabase.from("students").select("id").eq("institution_id", profile.institution_id)).data?.map((r: { id: string }) => r.id) ?? [];
          if (studentIds.length > 0) {
            const [totalEnrRes, activeEnrRes] = await Promise.all([
              supabase.from("enrollments").select("*", { count: "exact", head: true }).in("student_id", studentIds),
              supabase.from("enrollments").select("*", { count: "exact", head: true }).in("student_id", studentIds).eq("status", "active"),
            ]);
            statsMap.totalEnrollments = totalEnrRes.count ?? 0;
            statsMap.activeEnrollments = activeEnrRes.count ?? 0;
          }
        }

        if (canViewPayments) {
          const { data: allPlans } = await supabase.from("payment_plans").select("id, total_amount, status").eq("institution_id", profile.institution_id);
          statsMap.planCount = allPlans?.length ?? 0;
          const planIds = (allPlans ?? []).map((p) => p.id);
          if (planIds.length > 0) {
            const { data: allInstallments } = await supabase.from("installments").select("amount_due, amount_paid, status").in("payment_plan_id", planIds);
            statsMap.totalCollected = (allInstallments ?? []).reduce((s, i) => s + Number(i.amount_paid), 0);
            statsMap.totalOutstanding = (allInstallments ?? []).reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
            statsMap.totalOverdue = (allInstallments ?? []).filter((i) => i.status === "overdue").reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
          }
        }

        if (canViewExpenses) {
          const { data: allExpenses } = await supabase.from("expenses").select("amount").eq("institution_id", profile.institution_id);
          statsMap.totalExpenses = (allExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
        }

        setStats({
          totalStudents: statsMap.totalStudents ?? 0, activeStudents: statsMap.activeStudents ?? 0,
          newApplicants: statsMap.newApplicants ?? 0, reviewingApplicants: statsMap.reviewingApplicants ?? 0,
          admittedApplicants: statsMap.admittedApplicants ?? 0, activeEnrollments: statsMap.activeEnrollments ?? 0,
          totalEnrollments: statsMap.totalEnrollments ?? 0, totalCollected: statsMap.totalCollected ?? 0,
          totalOutstanding: statsMap.totalOutstanding ?? 0, totalOverdue: statsMap.totalOverdue ?? 0,
          totalExpenses: statsMap.totalExpenses ?? 0, planCount: statsMap.planCount ?? 0,
        });
      } catch { setStats(null); } finally { setLoadingStats(false); }
    }
    fetchStats();
  }, [profile?.institution_id, permissions]);

  return (
    <div>
      <PageHeader title={`Bonjour, ${displayName}`} description={`Vous êtes connecté en tant que ${primaryRole}.`} />
      {roles.includes("direction") || roles.includes("super_admin") ? (
        <DirectionDashboard stats={stats} loading={loadingStats} />
      ) : roles.includes("administration") || roles.includes("scolarite") ? (
        <AdminScolariteDashboard stats={stats} loading={loadingStats} />
      ) : roles.includes("comptabilite") ? (
        <ComptabiliteDashboard stats={stats} loading={loadingStats} />
      ) : roles.includes("formateur") ? (
        <FormateurDashboard />
      ) : roles.includes("etudiant") ? (
        <EtudiantDashboard />
      ) : (
        <Card className="p-6"><EmptyState title="Aucun tableau de bord disponible" message="Votre compte n'a pas de rôle attribué. Contactez un administrateur." /></Card>
      )}
    </div>
  );
}

function DirectionDashboard({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total étudiants" value={loading ? "…" : stats?.totalStudents ?? 0} icon={GraduationCap} />
        <StatCard label="Étudiants actifs" value={loading ? "…" : stats?.activeStudents ?? 0} icon={Users} />
        <StatCard label="Nouvelles candidatures" value={loading ? "…" : stats?.newApplicants ?? 0} icon={UserPlus} />
        <StatCard label="Candidatures acceptées" value={loading ? "…" : stats?.admittedApplicants ?? 0} icon={UserPlus} color="text-green-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Inscriptions actives" value={loading ? "…" : stats?.activeEnrollments ?? 0} icon={ClipboardCheck} color="text-green-600" />
        <StatCard label="Montant encaissé" value={loading ? "…" : formatMoney(stats?.totalCollected ?? 0)} icon={Banknote} color="text-green-600" />
        <StatCard label="Solde restant" value={loading ? "…" : formatMoney(stats?.totalOutstanding ?? 0)} icon={Clock} color="text-orange-600" />
        <StatCard label="Total dépenses" value={loading ? "…" : formatMoney(stats?.totalExpenses ?? 0)} icon={TrendingDown} color="text-red-600" />
      </div>
    </div>
  );
}

function AdminScolariteDashboard({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Nouvelles candidatures" value={loading ? "…" : stats?.newApplicants ?? 0} icon={UserPlus} />
        <StatCard label="En cours d'étude" value={loading ? "…" : stats?.reviewingApplicants ?? 0} icon={ClipboardCheck} color="text-amber-600" />
        <StatCard label="Acceptées" value={loading ? "…" : stats?.admittedApplicants ?? 0} icon={UserPlus} color="text-green-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total étudiants" value={loading ? "…" : stats?.totalStudents ?? 0} icon={GraduationCap} />
        <StatCard label="Inscriptions actives" value={loading ? "…" : stats?.activeEnrollments ?? 0} icon={ClipboardCheck} color="text-green-600" />
        <StatCard label="Total inscriptions" value={loading ? "…" : stats?.totalEnrollments ?? 0} icon={Users} />
      </div>
    </div>
  );
}

function ComptabiliteDashboard({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const netBalance = (stats?.totalCollected ?? 0) - (stats?.totalExpenses ?? 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total encaissé" value={loading ? "…" : formatMoney(stats?.totalCollected ?? 0)} icon={Banknote} color="text-green-600" />
        <StatCard label="Solde restant" value={loading ? "…" : formatMoney(stats?.totalOutstanding ?? 0)} icon={Clock} color="text-orange-600" />
        <StatCard label="En retard" value={loading ? "…" : formatMoney(stats?.totalOverdue ?? 0)} icon={AlertCircle} color="text-red-600" />
        <StatCard label="Échéanciers" value={loading ? "…" : stats?.planCount ?? 0} icon={Wallet} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total dépenses" value={loading ? "…" : formatMoney(stats?.totalExpenses ?? 0)} icon={TrendingDown} color="text-red-600" />
        <StatCard label="Balance nette" value={loading ? "…" : formatMoney(netBalance)} icon={TrendingUp} color={netBalance >= 0 ? "text-green-600" : "text-red-600"} />
      </div>
    </div>
  );
}

function FormateurDashboard() {
  const [stats, setStats] = useState({ classCount: 0, scheduleCount: 0, assessmentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: teacher } = await supabase.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
        if (!teacher) { setLoading(false); return; }

        const { data: schedules } = await supabase.from("schedules").select("class_id").eq("teacher_id", teacher.id);
        const classIds = Array.from(new Set((schedules ?? []).map((s) => s.class_id)));
        const { count: assessmentCount } = await supabase.from("assessments").select("*", { count: "exact", head: true });

        setStats({
          classCount: classIds.length,
          scheduleCount: schedules?.length ?? 0,
          assessmentCount: assessmentCount ?? 0,
        });
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Mes classes" value={loading ? "…" : stats.classCount} icon={Users} />
        <StatCard label="Mes séances" value={loading ? "…" : stats.scheduleCount} icon={BookOpen} />
        <StatCard label="Évaluations" value={loading ? "…" : stats.assessmentCount} icon={Award} />
      </div>
      <Card className="p-6"><EmptyState title="Espace formateur" message="Consultez vos classes, emploi du temps et évaluations depuis le menu latéral." /></Card>
    </div>
  );
}

function EtudiantDashboard() {
  const [stats, setStats] = useState({ enrollmentCount: 0, scheduleCount: 0, gradeCount: 0, outstandingAmount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: student } = await supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle();
        if (!student) { setLoading(false); return; }

        const { count: enrCount } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("student_id", student.id);
        const { count: schCount } = await supabase.from("schedules").select("*", { count: "exact", head: true });
        const { count: gradeCount } = await supabase.from("grades").select("*", { count: "exact", head: true }).eq("student_id", student.id);

        const { data: plans } = await supabase.from("payment_plans").select("id").eq("student_id", student.id);
        const planIds = (plans ?? []).map((p) => p.id);
        let outstanding = 0;
        if (planIds.length > 0) {
          const { data: insts } = await supabase.from("installments").select("amount_due, amount_paid").in("payment_plan_id", planIds);
          outstanding = (insts ?? []).reduce((s, i) => s + (Number(i.amount_due) - Number(i.amount_paid)), 0);
        }

        setStats({
          enrollmentCount: enrCount ?? 0,
          scheduleCount: schCount ?? 0,
          gradeCount: gradeCount ?? 0,
          outstandingAmount: outstanding,
        });
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Mes inscriptions" value={loading ? "…" : stats.enrollmentCount} icon={BookOpen} />
        <StatCard label="Mes séances" value={loading ? "…" : stats.scheduleCount} icon={CalendarDays} />
        <StatCard label="Mes notes" value={loading ? "…" : stats.gradeCount} icon={Award} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Solde restant à payer" value={loading ? "…" : formatMoney(stats.outstandingAmount)} icon={Wallet} color={stats.outstandingAmount > 0 ? "text-orange-600" : "text-green-600"} />
        <StatCard label="Notifications" value="—" icon={AlertCircle} />
      </div>
      <Card className="p-6"><EmptyState title="Espace étudiant" message="Consultez vos inscriptions, emploi du temps, notes et paiements depuis le menu latéral." /></Card>
    </div>
  );
}
