import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium transition-colors",
        isOnline
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          : "bg-destructive/10 text-destructive"
      )}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <CloudOff className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span>
          {isOnline
            ? `${pendingCount} modification(s) en attente de synchronisation`
            : "Mode hors ligne — les données seront synchronisées au retour"}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={syncNow}
          disabled={isSyncing}
          className="h-7 gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? "Sync…" : "Synchroniser"}
        </Button>
      )}
    </div>
  );
}
