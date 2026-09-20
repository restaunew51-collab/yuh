"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, LogOut, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, profile, roles, signOut, signingOut } = useAuth();
  const router = useRouter();

  const displayName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : user?.email ?? "Utilisateur";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel = roles.length > 0
    ? roles.map((r) => r.replace(/_/g, " ")).join(", ")
    : "Aucun rôle";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <Avatar className="w-8 h-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback className="text-xs bg-primary text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground leading-tight max-w-[140px] truncate">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground leading-tight capitalize">
              {roleLabel}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/profile" className="cursor-pointer">
            <User className="w-4 h-4 mr-2" />
            Mon profil
          </Link>
        </DropdownMenuItem>
        {roles.includes("super_admin") || roles.includes("direction") ? (
          <DropdownMenuItem asChild>
            <Link href="/app/admin/settings" className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Paramètres
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          disabled={signingOut}
          className={cn("cursor-pointer text-red-600 focus:text-red-600")}
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          {signingOut ? "Déconnexion..." : "Déconnexion"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
