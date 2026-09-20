"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface CreateStudentAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onCreated?: () => void;
}

export function CreateStudentAccountDialog({
  open,
  onOpenChange,
  student,
  onCreated,
}: CreateStudentAccountDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setEmail(student?.email ?? "");
      setPassword("");
      setErrors({});
    }
  }, [open, student]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "L'email est requis";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email invalide";
    if (password.length < 6) e.password = "Le mot de passe doit faire au moins 6 caractères";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !student) return;

    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "link_student_account",
          student_id: student.id,
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur");
      }

      toast({
        title: "Compte portail créé",
        description: "L'étudiant peut désormais se connecter avec son email et mot de passe.",
      });
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Créer un compte portail étudiant</DialogTitle>
          <DialogDescription>
            {student
              ? `Un compte sera créé pour ${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
              : "Crée un compte Auth et le lie à cet étudiant."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account_email">Email de connexion *</Label>
            <Input
              id="account_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="etudiant@email.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_password">Mot de passe temporaire *</Label>
            <Input
              id="account_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Minimum 6 caractères"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Le compte sera créé avec le rôle « Étudiant » et lié à l'institution de l'étudiant.
              L'étudiant pourra se connecter et accéder à son portail.
            </span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer le compte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
