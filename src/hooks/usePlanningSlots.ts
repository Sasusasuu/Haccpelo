import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlanningSlot {
  id: string;
  employee_id: string;
  week_key: string;
  day_index: number;
  start_time: string;
  end_time: string;
  role: string | null;
}

export function usePlanningSlots(userId: string | undefined, weekKey: string) {
  const [slots, setSlots] = useState<PlanningSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!userId || !weekKey) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("planning_slots")
        .select("id, employee_id, week_key, day_index, start_time, end_time, role")
        .eq("user_id", userId)
        .eq("week_key", weekKey);
      if (dbError) throw dbError;
      if (data) setSlots(data);
    } catch {
      setError("Impossible de charger le planning. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId, weekKey]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const fetchSlotsByWeekKey = async (wk: string): Promise<PlanningSlot[]> => {
    if (!userId) return [];
    const { data, error: dbError } = await supabase
      .from("planning_slots")
      .select("id, employee_id, week_key, day_index, start_time, end_time, role")
      .eq("user_id", userId)
      .eq("week_key", wk);
    if (!dbError && data) return data;
    return [];
  };

  const addSlots = async (entries: { employeeId: string; dayIndex: number; startTime: string; endTime: string; role?: string }[]) => {
    if (!userId || entries.length === 0) return;
    try {
      const rows = entries.map(e => ({
        user_id: userId,
        employee_id: e.employeeId,
        week_key: weekKey,
        day_index: e.dayIndex,
        start_time: e.startTime,
        end_time: e.endTime,
        role: e.role || null,
      }));
      const { data, error: dbError } = await supabase
        .from("planning_slots")
        .insert(rows)
        .select("id, employee_id, week_key, day_index, start_time, end_time, role");
      if (dbError) throw dbError;
      if (data) setSlots(prev => [...prev, ...data]);
    } catch {
      setError("Impossible d'ajouter le créneau.");
    }
  };

  const deleteSlot = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("planning_slots").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch {
      setError("Impossible de supprimer le créneau.");
    }
  };

  return { slots, loading, error, addSlots, deleteSlot, fetchSlotsByWeekKey, retry: fetchSlots };
}
