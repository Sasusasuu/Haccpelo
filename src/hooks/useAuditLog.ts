import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  action_type: string;
  category: string;
  description: string;
  created_at: string;
}

export type AuditCategory = "badgeuse" | "dlc" | "haccp" | "planning" | "parametres" | "memos" | "general";

const CATEGORY_MAP: Record<string, AuditCategory> = {
  clock_in: "badgeuse",
  clock_out: "badgeuse",
  product_added: "dlc",
  product_updated: "dlc",
  product_deleted: "dlc",
  label_printed: "dlc",
  temp_logged: "haccp",
  temp_deleted: "haccp",
  cleaning_done: "haccp",
  planning_slot_added: "planning",
  planning_slot_deleted: "planning",
  planning_week_copied: "planning",
  planning_unlocked: "planning",
  memo_added: "memos",
  memo_deleted: "memos",
  settings_unlocked: "parametres",
  employee_added: "parametres",
  employee_deleted: "parametres",
  employee_updated: "parametres",
  employee_pin_changed: "parametres",
  employee_role_changed: "parametres",
  role_added: "parametres",
  role_updated: "parametres",
  role_deleted: "parametres",
  export_comptable: "parametres",
  manager_pin_changed: "parametres",
  session_duration_changed: "parametres",
};

export function resolveCategory(actionType: string): AuditCategory {
  return CATEGORY_MAP[actionType] ?? "general";
}

export function useAuditLog(userId: string) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (offset = 0) => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, employee_id, employee_name, action_type, category, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!error && data) {
      if (offset === 0) setLogs(data as AuditEntry[]);
      else setLogs(prev => [...prev, ...(data as AuditEntry[])]);
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
    employeeName?: string | null,
  ) => {
    const category = resolveCategory(actionType);
    const entry = {
      user_id: userId,
      employee_id: employeeId ?? null,
      employee_name: employeeName ?? null,
      action_type: actionType,
      category,
      description,
    };
    const { data } = await supabase
      .from("audit_logs")
      .insert(entry)
      .select("id, employee_id, employee_name, action_type, category, description, created_at")
      .single();
    if (data) setLogs(prev => [data as AuditEntry, ...prev]);
  }, [userId]);

  const exportCSV = useCallback(() => {
    const header = "DATE_HEURE;UTILISATEUR;CATEGORIE;ACTION;DESCRIPTION";
    const rows = logs.map(l => {
      const dt = new Date(l.created_at);
      const dateStr = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const user = l.employee_name || "—";
      const cat = l.category;
      const action = l.action_type;
      const desc = l.description.replace(/;/g, ",");
      return `${dateStr};${user};${cat};${action};${desc}`;
    });
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Try native share on mobile
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], "logs.csv", { type: "text/csv" })] })) {
      navigator.share({
        files: [new File([blob], "journal_activite.csv", { type: "text/csv" })],
        title: "Journal d'activité",
      }).catch(() => downloadBlob(blob));
    } else {
      downloadBlob(blob);
    }
  }, [logs]);

  return { logs, loading, hasMore, loadMore, log, refresh: () => fetchLogs(0), exportCSV };
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `journal_activite_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
