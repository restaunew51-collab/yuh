"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

function formatSegment(segment: string): string {
  const map: Record<string, string> = {
    dashboard: "Tableau de bord",
    admin: "Administration",
    students: "Étudiants",
    teachers: "Formateurs",
    applicants: "Candidats",
    programs: "Formations",
    classes: "Classes",
    enrollments: "Inscriptions",
    schedules: "Planning",
    attendance: "Présences",
    grades: "Notes",
    payments: "Paiements",
    expenses: "Dépenses",
    documents: "Documents",
    notifications: "Notifications",
    users: "Utilisateurs",
    audit: "Audit",
    settings: "Paramètres",
    profile: "Profil",
    direction: "Direction",
    scolarite: "Scolarité",
    comptabilite: "Comptabilité",
    formateur: "Formateur",
    etudiant: "Étudiant",
  };
  return map[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const label = formatSegment(segment);

        return (
          <span key={href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="w-3 h-3" />}
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
