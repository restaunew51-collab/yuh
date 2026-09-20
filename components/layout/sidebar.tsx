"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { NAV_SECTIONS } from "@/lib/rbac/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const { permissions, roles } = useAuth();

  const isStudentOnly = roles.includes("etudiant") && !roles.some((r) => ["super_admin", "direction", "administration", "scolarite", "comptabilite"].includes(r));
  const isTeacherOnly = roles.includes("formateur") && !roles.some((r) => ["super_admin", "direction", "administration", "scolarite", "comptabilite"].includes(r));

  const canSeeItem = (itemPermissions?: string[]) => {
    if (!itemPermissions || itemPermissions.length === 0) return true;
    return itemPermissions.some((p) => permissions.includes(p as never));
  };

  const canSeeSection = (sectionLabel: string) => {
    if (isStudentOnly) return sectionLabel === "Principal" || sectionLabel === "Mon espace étudiant";
    if (isTeacherOnly) return sectionLabel === "Principal" || sectionLabel === "Mon espace formateur";
    return sectionLabel !== "Mon espace étudiant" && sectionLabel !== "Mon espace formateur";
  };

  return (
    <aside
      className={cn(
        "h-full bg-slate-900 text-slate-200 flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white truncate">
            Centre de Formation
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {NAV_SECTIONS.filter((s) => canSeeSection(s.label)).map((section) => {
          const visibleItems = section.items.filter((item) => canSeeItem(item.permissions));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <p className="px-4 text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (pathname.startsWith(item.href + "/") && item.href !== "/dashboard");
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm rounded-lg mx-2 transition-colors",
                          isActive
                            ? "bg-primary text-white font-medium"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white",
                          collapsed && "justify-center"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-12 border-t border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <>
            <ChevronLeft className="w-4 h-4 mr-2" />
            <span className="text-xs">Réduire</span>
          </>
        )}
      </button>
    </aside>
  );
}
