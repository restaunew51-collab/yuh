"use client";

import { useAuth } from "@/components/auth/auth-provider";
import type { Permission } from "@/lib/rbac/permissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PermissionGuard({
  permission,
  children,
  fallback,
}: {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { permissions } = useAuth();

  const hasAccess = Array.isArray(permission)
    ? permission.some((p) => permissions.includes(p))
    : permissions.includes(permission);

  if (!hasAccess) {
    return (
      fallback ?? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Accès refusé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vous n'avez pas la permission d'accéder à cette section.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/app/dashboard">Retour au tableau de bord</Link>
          </Button>
        </div>
      )
    );
  }

  return <>{children}</>;
}
