import type { Permission } from "@/lib/rbac/permissions";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  GraduationCap,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Award,
  Wallet,
  Receipt,
  FileText,
  Bell,
  Settings,
  ShieldCheck,
  ScrollText,
  CalendarRange,
  Layers,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: Permission[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Principal",
    items: [
      {
        label: "Tableau de bord",
        href: "/app/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Mon espace étudiant",
    items: [
      {
        label: "Mes inscriptions",
        href: "/app/student/enrollments",
        icon: ClipboardCheck,
        permissions: ["enrollments.view"],
      },
      {
        label: "Mon emploi du temps",
        href: "/app/student/schedule",
        icon: CalendarDays,
        permissions: ["schedules.view"],
      },
      {
        label: "Mes présences",
        href: "/app/student/attendance",
        icon: ClipboardCheck,
        permissions: ["attendance.view"],
      },
      {
        label: "Mes notes",
        href: "/app/student/grades",
        icon: Award,
        permissions: ["grades.view"],
      },
      {
        label: "Mes bulletins",
        href: "/app/student/bulletins",
        icon: FileText,
        permissions: ["grades.view"],
      },
      {
        label: "Mes paiements",
        href: "/app/student/payments",
        icon: Wallet,
        permissions: ["payments.view"],
      },
      {
        label: "Mes documents",
        href: "/app/student/documents",
        icon: FileText,
        permissions: ["documents.view"],
      },
      {
        label: "Mes notifications",
        href: "/app/student/notifications",
        icon: Bell,
        permissions: ["notifications.view"],
      },
    ],
  },
  {
    label: "Mon espace formateur",
    items: [
      {
        label: "Mes classes",
        href: "/app/teacher/classes",
        icon: Users,
        permissions: ["classes.view"],
      },
      {
        label: "Mon emploi du temps",
        href: "/app/teacher/schedule",
        icon: CalendarDays,
        permissions: ["schedules.view"],
      },
      {
        label: "Présences",
        href: "/app/teacher/attendance",
        icon: ClipboardCheck,
        permissions: ["attendance.view"],
      },
      {
        label: "Évaluations",
        href: "/app/teacher/assessments",
        icon: Award,
        permissions: ["assessments.view"],
      },
      {
        label: "Saisie des notes",
        href: "/app/teacher/grades",
        icon: Award,
        permissions: ["grades.view"],
      },
      {
        label: "Documents",
        href: "/app/teacher/documents",
        icon: FileText,
        permissions: ["documents.view"],
      },
      {
        label: "Notifications",
        href: "/app/teacher/notifications",
        icon: Bell,
        permissions: ["notifications.view"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Étudiants",
        href: "/app/admin/students",
        icon: GraduationCap,
        permissions: ["students.view"],
      },
      {
        label: "Candidats",
        href: "/app/admin/applicants",
        icon: UserPlus,
        permissions: ["applicants.view"],
      },
      {
        label: "Formateurs",
        href: "/app/admin/teachers",
        icon: Users,
        permissions: ["teachers.view"],
      },
      {
        label: "Formations",
        href: "/app/admin/programs",
        icon: BookOpen,
        permissions: ["programs.view"],
      },
      {
        label: "Cours",
        href: "/app/admin/courses",
        icon: Layers,
        permissions: ["courses.view"],
      },
      {
        label: "Classes",
        href: "/app/admin/classes",
        icon: Users,
        permissions: ["classes.view"],
      },
      {
        label: "Années académiques",
        href: "/app/admin/academic-years",
        icon: CalendarRange,
        permissions: ["settings.view"],
      },
      {
        label: "Périodes",
        href: "/app/admin/terms",
        icon: CalendarDays,
        permissions: ["settings.view"],
      },
      {
        label: "Inscriptions",
        href: "/app/admin/enrollments",
        icon: ClipboardCheck,
        permissions: ["enrollments.view"],
      },
      {
        label: "Planning",
        href: "/app/admin/schedules",
        icon: CalendarDays,
        permissions: ["schedules.view"],
      },
    ],
  },
  {
    label: "Pédagogie",
    items: [
      {
        label: "Présences",
        href: "/app/admin/attendance",
        icon: ClipboardCheck,
        permissions: ["attendance.view"],
      },
      {
        label: "Notes",
        href: "/app/admin/grades",
        icon: Award,
        permissions: ["grades.view"],
      },
      {
        label: "Bulletins",
        href: "/app/admin/bulletins",
        icon: FileText,
        permissions: ["grades.view"],
      },
    ],
  },
  {
    label: "Finances",
    items: [
      {
        label: "Paiements",
        href: "/app/admin/payments",
        icon: Wallet,
        permissions: ["payments.view"],
      },
      {
        label: "Dépenses",
        href: "/app/admin/expenses",
        icon: Receipt,
        permissions: ["expenses.view"],
      },
    ],
  },
  {
    label: "Outils",
    items: [
      {
        label: "Documents",
        href: "/app/admin/documents",
        icon: FileText,
        permissions: ["documents.view"],
      },
      {
        label: "Notifications",
        href: "/app/admin/notifications",
        icon: Bell,
        permissions: ["notifications.view"],
      },
      {
        label: "Utilisateurs",
        href: "/app/admin/users",
        icon: Users,
        permissions: ["users.view"],
      },
      {
        label: "Audit",
        href: "/app/admin/audit",
        icon: ScrollText,
        permissions: ["audit.view"],
      },
      {
        label: "Rapports",
        href: "/app/admin/reports",
        icon: BarChart3,
        permissions: ["reports.view"],
      },
      {
        label: "Paramètres",
        href: "/app/admin/settings",
        icon: Settings,
        permissions: ["settings.view"],
      },
    ],
  },
];
