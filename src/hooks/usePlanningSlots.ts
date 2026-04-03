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

  const fetchSlots = useCallback(async () => {
    if (!userId || !weekKey) return;
    const { data, error } = await supabase
      .from("planning_slots")
      .select("id, employee_id, week_key, day_index, start_time, end_time, role")
      .eq("user_id", userId)
      .eq("week_key", weekKey);
    if (!error && data) setSlots(data);
    setLoading(false);
  }, [userId, weekKey]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const addSlot = async (employeeId: string, dayIndex: number, startTime: string, endTime: string, role?: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("planning_slots")
      .insert({ user_id: userId, employee_id: employeeId, week_key: weekKey, day_index: dayIndex, start_time: startTime, end_time: endTime, role: role || null })
      .select("id, employee_id, week_key, day_index, start_time, end_time, role")
      .single();
    if (!error && data) setSlots(prev => [...prev, data]);
    return data;
  };

  const addSlots = async (entries: { employeeId: string; dayIndex: number; startTime: string; endTime: string }[]) => {
    if (!userId || entries.length === 0) return;
    const rows = entries.map(e => ({
      user_id: userId,
      employee_id: e.employeeId,
      week_key: weekKey,
      day_index: e.dayIndex,
      start_time: e.startTime,
      end_time: e.endTime,
    }));
    const { data, error } = await supabase
      .from("planning_slots")
      .insert(rows)
      .select("id, employee_id, week_key, day_index, start_time, end_time");
    if (!error && data) setSlots(prev => [...prev, ...data]);
  };

  const deleteSlot = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("planning_slots").delete().eq("id", id).eq("user_id", userId);
    if (!error) setSlots(prev => prev.filter(s => s.id !== id));
  };

  return { slots, loading, addSlot, addSlots, deleteSlot };
}
