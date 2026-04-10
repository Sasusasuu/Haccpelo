import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TemperatureLog {
  id: string;
  equipment_name: string;
  period: "matin" | "soir";
  temperature: number;
  log_date: string;
}

export function useTemperatureLogs(userId: string | undefined) {
  const [logs, setLogs] = useState<TemperatureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("temperature_logs")
        .select("id, equipment_name, period, temperature, log_date")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .order("equipment_name", { ascending: true });
      if (dbError) throw dbError;
      if (data) setLogs(data as TemperatureLog[]);
    } catch {
      setError("Impossible de charger les relevés de températures. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const addLog = async (log: Omit<TemperatureLog, "id">) => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("temperature_logs")
        .insert({ user_id: userId, equipment_name: log.equipment_name, period: log.period, temperature: log.temperature, log_date: log.log_date })
        .select("id, equipment_name, period, temperature, log_date")
        .single();
      if (dbError) throw dbError;
      if (data) setLogs(prev => [data as TemperatureLog, ...prev]);
    } catch {
      setError("Impossible d'enregistrer le relevé.");
    }
  };

  const deleteLog = async (id: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { error: dbError } = await supabase.from("temperature_logs").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch {
      setError("Impossible de supprimer le relevé.");
    }
  };

  return { logs, loading, error, addLog, deleteLog, retry: fetchLogs };
}
