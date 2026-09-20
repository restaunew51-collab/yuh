import { Loader2 } from "lucide-react";

export function LoadingState({ message = "Chargement..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
