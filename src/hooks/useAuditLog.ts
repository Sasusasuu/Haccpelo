import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  employee_id: string | null;
  action_type: string;
  description: string;
  created_at: string;
}

export function useAuditLog(userId: string) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async (offset = 0) => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, employee_id, action_type, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!error && data) {
      if (offset === 0) setLogs(data);
      else setLogs(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchLogs(0); }, [fetchLogs]);

  const loadMore = () => fetchLogs(logs.length);

  const log = useCallback(async (
    actionType: string,
    description: string,
    employeeId?: string | null,
  ) => {
    const entry = {
      user_id: userId,
      employee_id: employeeId ?? null,
      action_type: actionType,
      description,
    };
    const { data } = await supabase
      .from("audit_logs")
      .insert(entry)
      .select("id, employee_id, action_type, description, created_at")
      .single();
    if (data) setLogs(prev => [data, ...prev]);
  }, [userId]);

  return { logs, loading, hasMore, loadMore, log, refresh: () => fetchLogs(0) };
}
