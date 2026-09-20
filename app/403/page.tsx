import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Accès refusé — Centre de Formation" };

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Accès refusé</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.
        </p>
        <Button asChild>
          <Link href="/app/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  );
}
