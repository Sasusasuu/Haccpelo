import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CleaningTask {
  id: string;
  zone: string;
  task_name: string;
  frequency: "quotidien" | "hebdomadaire" | "mensuel";
}

export interface CleaningLog {
  id: string;
  task_id: string;
  done_date: string;
  done_by: string;
}

export function useCleaningPlan(userId: string | undefined) {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    const [t, l] = await Promise.all([
      supabase.from("cleaning_tasks").select("id, zone, task_name, frequency").eq("user_id", userId).order("zone"),
      supabase.from("cleaning_logs").select("id, task_id, done_date, done_by").eq("user_id", userId).order("done_date", { ascending: false }),
    ]);
    if (!t.error && t.data) setTasks(t.data as CleaningTask[]);
    if (!l.error && l.data) setLogs(l.data as CleaningLog[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTask = async (task: Omit<CleaningTask, "id">) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("cleaning_tasks")
      .insert({ user_id: userId, zone: task.zone, task_name: task.task_name, frequency: task.frequency })
      .select("id, zone, task_name, frequency")
      .single();
    if (!error && data) setTasks(prev => [...prev, data as CleaningTask]);
  };

  const deleteTask = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("cleaning_tasks").delete().eq("id", id).eq("user_id", userId);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
      setLogs(prev => prev.filter(l => l.task_id !== id));
    }
  };

  const logDone = async (taskId: string, doneBy: string, doneDate?: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("cleaning_logs")
      .insert({ user_id: userId, task_id: taskId, done_by: doneBy, done_date: doneDate || new Date().toISOString().split("T")[0] })
      .select("id, task_id, done_date, done_by")
      .single();
    if (!error && data) setLogs(prev => [data as CleaningLog, ...prev]);
  };

  const deleteLog = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("cleaning_logs").delete().eq("id", id).eq("user_id", userId);
    if (!error) setLogs(prev => prev.filter(l => l.id !== id));
  };

  return { tasks, logs, loading, addTask, deleteTask, logDone, deleteLog };
}
