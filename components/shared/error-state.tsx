import { AlertTriangle } from "lucide-react";

export function ErrorState({
  message = "Une erreur s'est produite",
  action,
}: {
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
