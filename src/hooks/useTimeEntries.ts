import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimeEntry {
  id: string;
  employee_id: string;
  work_date: string;
  arrival_ts: number | null;
  departure_ts: number | null;
}

export function useTimeEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error: dbError } = await supabase
        .from("time_entries")
        .select("id, employee_id, work_date, arrival_ts, departure_ts")
        .eq("user_id", userId)
        .gte("work_date", since.toISOString().split("T")[0])
        .order("work_date", { ascending: false });
      if (dbError) throw dbError;
      if (data) setEntries(data);
    } catch {
      setError("Impossible de charger les pointages. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const clockIn = async (employeeId: string) => {
    if (!userId) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error: dbError } = await supabase
        .from("time_entries")
        .insert({ user_id: userId, employee_id: employeeId, work_date: today, arrival_ts: Date.now() })
        .select("id, employee_id, work_date, arrival_ts, departure_ts")
        .single();
      if (dbError) throw dbError;
      if (data) setEntries(prev => [data, ...prev]);
    } catch {
      setError("Impossible d'enregistrer l'arrivée.");
    }
  };

  const clockOut = async (entryId: string) => {
    if (!userId) return;
    try {
      const now = Date.now();
      const { error: dbError } = await supabase
        .from("time_entries")
        .update({ departure_ts: now })
        .eq("id", entryId)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, departure_ts: now } : e));
    } catch {
      setError("Impossible d'enregistrer le départ.");
    }
  };

  return { entries, loading, error, clockIn, clockOut, retry: fetchEntries };
}
