"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  Bell, Plus, CheckCheck, Mail, MailOpen, Trash2, Loader2,
} from "lucide-react";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

const TYPE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  enrollment: { label: "Inscription", variant: "default" },
  class_transfer: { label: "Transfert", variant: "secondary" },
  payment: { label: "Paiement", variant: "default" },
  grade: { label: "Note", variant: "secondary" },
  validation: { label: "Validation", variant: "outline" },
  certificate: { label: "Certificat", variant: "default" },
  admin: { label: "Administration", variant: "outline" },
};

const TARGET_OPTIONS = [
  { value: "all", label: "Tous les utilisateurs" },
  { value: "role", label: "Par rôle" },
  { value: "specific", label: "Utilisateur spécifique" },
];

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin" },
  { value: "direction", label: "Direction" },
  { value: "administration", label: "Administration" },
  { value: "scolarite", label: "Scolarité" },
  { value: "comptabilite", label: "Comptabilité" },
  { value: "formateur", label: "Formateur" },
  { value: "etudiant", label: "Étudiant" },
];

export default function NotificationsPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [formOpen, setFormOpen] = useState(false);

  const canCreate = permissions.includes("notifications.create" as never);
  const canView = permissions.includes("notifications.view" as never) || canCreate;

  const fetchNotifications = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("institution_id", profile.institution_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter === "unread") query = query.eq("is_read", false);

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkAsRead = async (notif: Notification) => {
    if (notif.is_read) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);
      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    try {
      for (const n of unread) {
        await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      }
      toast({ title: "Notifications marquées comme lues" });
      fetchNotifications();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (!canView) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <Card className="p-6">
          <EmptyState title="Accès refusé" message="Vous n'avez pas la permission d'accéder à cette section." />
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div><PageHeader title="Notifications" description="Historique et envoi de notifications" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Historique et envoi de notifications"
        action={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead}>
                <CheckCheck className="w-4 h-4 mr-2" /> Tout marquer lu
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nouvelle notification
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          Toutes ({notifications.length})
        </Button>
        <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>
          Non lues ({unreadCount})
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="Aucune notification"
            message={filter === "unread" ? "Aucune notification non lue." : "Aucune notification envoyée."}
            action={canCreate && (
              <Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Créer</Button>
            )}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card key={notif.id} className={`p-4 ${notif.is_read ? "" : "border-primary/50 bg-primary/5"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${notif.is_read ? "bg-muted" : "bg-primary/10"}`}>
                  {notif.is_read ? (
                    <MailOpen className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Mail className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <Badge variant={TYPE_CONFIG[notif.type]?.variant ?? "outline"}>
                      {TYPE_CONFIG[notif.type]?.label ?? notif.type}
                    </Badge>
                  </div>
                  {notif.message && <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(notif.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                {!notif.is_read && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkAsRead(notif)}>
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canCreate && (
        <NotificationFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          institutionId={profile?.institution_id ?? ""}
          onSaved={fetchNotifications}
        />
      )}
    </div>
  );
}

function NotificationFormDialog({
  open, onOpenChange, institutionId, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("admin");
  const [targetMode, setTargetMode] = useState("all");
  const [selectedRole, setSelectedRole] = useState("");
  const [specificProfileId, setSpecificProfileId] = useState("");
  const [profileOptions, setProfileOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setMessage("");
      setType("admin");
      setTargetMode("all");
      setSelectedRole("");
      setSpecificProfileId("");
    }
  }, [open]);

  useEffect(() => {
    if (open && targetMode === "specific" && institutionId) {
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("institution_id", institutionId)
        .order("last_name")
        .then(({ data }) => {
          setProfileOptions((data ?? []).map((p) => ({
            id: p.id,
            label: `${p.last_name} ${p.first_name}`.trim(),
          })));
        });
    }
  }, [open, targetMode, institutionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !institutionId) return;
    setLoading(true);
    try {
      let targetProfileIds: string[] = [];

      if (targetMode === "specific") {
        if (!specificProfileId) {
          toast({ title: "Erreur", description: "Sélectionnez un utilisateur.", variant: "destructive" });
          setLoading(false);
          return;
        }
        targetProfileIds = [specificProfileId];
      } else if (targetMode === "role") {
        if (!selectedRole) {
          toast({ title: "Erreur", description: "Sélectionnez un rôle.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { data: roleData } = await supabase
          .from("roles")
          .select("id")
          .eq("code", selectedRole)
          .maybeSingle();

        if (!roleData) {
          toast({ title: "Erreur", description: "Rôle introuvable.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role_id", roleData.id)
          .eq("institution_id", institutionId);

        targetProfileIds = (userRoles ?? []).map((ur: { user_id: string }) => ur.user_id);
      } else {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("institution_id", institutionId);
        targetProfileIds = (allProfiles ?? []).map((p) => p.id);
      }

      if (targetProfileIds.length === 0) {
        toast({ title: "Aucun destinataire", description: "Aucun utilisateur ne correspond aux critères.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const inserts = targetProfileIds.map((pid) => ({
        profile_id: pid,
        institution_id: institutionId,
        title: title.trim(),
        message: message.trim() || null,
        type,
        is_read: false,
      }));

      const { error } = await supabase.from("notifications").insert(inserts);
      if (error) throw error;

      toast({ title: "Notification envoyée", description: `${targetProfileIds.length} destinataire(s).` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Envoi impossible.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle notification</DialogTitle>
          <DialogDescription>Envoyer une notification à des utilisateurs.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Titre *</Label>
            <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea id="notif-message" value={message} onChange={(e) => setMessage(e.target.value)} disabled={loading} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Destinataires</Label>
            <Select value={targetMode} onValueChange={setTargetMode} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {targetMode === "role" && (
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {targetMode === "specific" && (
            <div className="space-y-2">
              <Label>Utilisateur</Label>
              <Select value={specificProfileId} onValueChange={setSpecificProfileId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {profileOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
