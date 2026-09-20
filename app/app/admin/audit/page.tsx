"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
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
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";

type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "Création", variant: "default" },
  UPDATE: { label: "Modification", variant: "secondary" },
  DELETE: { label: "Suppression", variant: "destructive" },
};

const TABLE_LABELS: Record<string, string> = {
  students: "Étudiants",
  applicants: "Candidats",
  teachers: "Formateurs",
  enrollments: "Inscriptions",
  classes: "Classes",
  courses: "Cours",
  programs: "Formations",
  schedules: "Planning",
  attendance: "Présences",
  assessments: "Évaluations",
  grades: "Notes",
  payment_plans: "Échéanciers",
  payments: "Paiements",
  expenses: "Dépenses",
  documents: "Documents",
  certificates: "Certificats",
  notifications: "Notifications",
  profiles: "Utilisateurs",
  user_roles: "Rôles",
  class_transfers: "Transferts",
  institutions: "Institutions",
};

function exportCSV(logs: AuditLog[]) {
  const headers = ["Date", "Action", "Module", "Utilisateur", "Enregistrement"];
  const rows = logs.map((l) => [
    new Date(l.created_at).toLocaleString("fr-FR"),
    ACTION_LABELS[l.action]?.label ?? l.action,
    TABLE_LABELS[l.table_name] ?? l.table_name,
    l.user_id ?? "—",
    l.record_id ?? "—",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const { permissions, profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const canView = permissions.includes("audit.view" as never);

  const fetchLogs = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (search.trim()) query = query.ilike("table_name", `%${search.trim()}%`);

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      setLogs(data ?? []);
      setTotalCount(count ?? 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, actionFilter, tableFilter, search, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!canView) {
    return <div><PageHeader title="Journal d'audit" /><Card className="p-6"><EmptyState title="Accès refusé" message="Vous n'avez pas la permission de consulter l'audit." /></Card></div>;
  }

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        description="Historique des opérations sensibles"
        action={logs.length > 0 && (
          <Button variant="outline" onClick={() => exportCSV(logs)}>
            <Download className="w-4 h-4 mr-2" /> Exporter CSV
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par module..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Toutes les actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les modules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modules</SelectItem>
              {Object.entries(TABLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <EmptyState title="Aucune entrée" message="Aucun événement d'audit ne correspond à vos critères." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Enregistrement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_LABELS[log.action]?.variant ?? "outline"}>
                          {ACTION_LABELS[log.action]?.label ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {TABLE_LABELS[log.table_name] ?? log.table_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono text-xs">
                        {log.user_id ? log.user_id.slice(0, 8) + "…" : "Système"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono text-xs">
                        {log.record_id ? log.record_id.slice(0, 8) + "…" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{totalCount} entrée{totalCount > 1 ? "s" : ""}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
