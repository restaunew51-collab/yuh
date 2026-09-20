"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { usePathname } from "next/navigation";

const SECTION_MAP: Record<string, { title: string; description: string; permission: string }> = {
  schedules: { title: "Planning", description: "Gestion de l'emploi du temps", permission: "schedules.view" },
  attendance: { title: "Présences", description: "Gestion des présences et absences", permission: "attendance.view" },
  grades: { title: "Notes", description: "Gestion des notes et bulletins", permission: "grades.view" },
  payments: { title: "Paiements", description: "Gestion des paiements et échéances", permission: "payments.view" },
  expenses: { title: "Dépenses", description: "Gestion des dépenses et recettes", permission: "expenses.view" },
  documents: { title: "Documents", description: "Gestion des documents", permission: "documents.view" },
  notifications: { title: "Notifications", description: "Gestion des notifications", permission: "notifications.view" },
  users: { title: "Utilisateurs", description: "Gestion des utilisateurs et rôles", permission: "users.view" },
  audit: { title: "Journal d'audit", description: "Historique des opérations sensibles", permission: "audit.view" },
  settings: { title: "Paramètres", description: "Configuration de l'établissement", permission: "settings.view" },
};

export default function AdminSectionPage({ params }: { params: { section: string | string[] } }) {
  const { permissions } = useAuth();
  const pathname = usePathname();
  const section = Array.isArray(params.section) ? (params.section[0] ?? "") : (params.section ?? "");
  const config = SECTION_MAP[section];

  if (!config) {
    return (
      <div>
        <PageHeader title="Section introuvable" />
        <Card className="p-6">
          <EmptyState title="Cette section n'existe pas" />
        </Card>
      </div>
    );
  }

  if (!permissions.includes(config.permission as never)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-medium">Accès refusé</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vous n'avez pas la permission d'accéder à cette section.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={config.title} description={config.description} />
      <Card className="p-6">
        <EmptyState
          title="Module en cours de développement"
          message="Cette section sera disponible prochainement."
        />
      </Card>
    </div>
  );
}
