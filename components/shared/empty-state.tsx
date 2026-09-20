import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Aucune donnée disponible",
  message,
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Inbox className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message && <p className="text-sm text-muted-foreground mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
