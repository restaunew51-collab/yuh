"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantId: string;
  applicantName: string;
  onConverted?: () => void;
}

export function ConvertToStudentDialog({
  open,
  onOpenChange,
  applicantId,
  applicantName,
  onConverted,
}: ConvertDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("convert_applicant_to_student", {
        p_applicant_id: applicantId,
      });

      if (error) throw error;

      toast({
        title: "Conversion réussie",
        description: `${applicantName} est maintenant un étudiant.`,
      });

      onConverted?.();
      onOpenChange(false);

      if (data) {
        router.push(`/app/admin/students/${data}`);
      }
    } catch (err) {
      toast({
        title: "Erreur de conversion",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Convertir en étudiant</DialogTitle>
              <DialogDescription>
                Convertir la candidature de {applicantName} en dossier étudiant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Cette action va créer un dossier étudiant avec un numéro de matricule unique.
            Le statut du candidat sera automatiquement mis à jour.
          </p>
          <p className="text-xs text-amber-600 font-medium">
            Cette action est irréversible.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={handleConvert} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Convertir en étudiant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
