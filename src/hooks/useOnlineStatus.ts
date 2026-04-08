import { useState, useEffect, useCallback } from "react";
import { flushQueue, getPendingCount } from "@/lib/offlineQueue";
import { toast } from "sonner";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { success, failed } = await flushQueue();
      if (success > 0) {
        toast.success(`${success} modification(s) synchronisée(s)`);
      }
      if (failed > 0) {
        toast.error(`${failed} modification(s) en échec — seront retentées`);
      }
    } finally {
      setIsSyncing(false);
      await refreshPending();
    }
  }, [isSyncing, refreshPending]);

  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      toast.success("Connexion rétablie — synchronisation…");
      await syncNow();
    };
    const goOffline = () => {
      setIsOnline(false);
      toast.warning("Hors ligne — les modifications seront enregistrées localement");
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    refreshPending();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow, refreshPending]);

  return { isOnline, pendingCount, isSyncing, syncNow, refreshPending };
}
