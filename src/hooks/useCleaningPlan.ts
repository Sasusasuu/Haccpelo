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
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [t, l] = await Promise.all([
        supabase.from("cleaning_tasks").select("id, zone, task_name, frequency").eq("user_id", userId).order("zone"),
        supabase.from("cleaning_logs").select("id, task_id, done_date, done_by").eq("user_id", userId).order("done_date", { ascending: false }),
      ]);
      if (t.error) throw t.error;
      if (l.error) throw l.error;
      if (t.data) setTasks(t.data as CleaningTask[]);
      if (l.data) setLogs(l.data as CleaningLog[]);
    } catch {
      setError("Impossible de charger le plan de nettoyage. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTask = async (task: Omit<CleaningTask, "id">) => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("cleaning_tasks")
        .insert({ user_id: userId, zone: task.zone, task_name: task.task_name, frequency: task.frequency })
        .select("id, zone, task_name, frequency")
        .single();
      if (dbError) throw dbError;
      if (data) setTasks(prev => [...prev, data as CleaningTask]);
    } catch {
      setError("Impossible d'ajouter la tâche.");
    }
  };

  const deleteTask = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("cleaning_tasks").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setTasks(prev => prev.filter(t => t.id !== id));
      setLogs(prev => prev.filter(l => l.task_id !== id));
    } catch {
      setError("Impossible de supprimer la tâche.");
    }
  };

  const logDone = async (taskId: string, doneBy: string, doneDate?: string) => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("cleaning_logs")
        .insert({ user_id: userId, task_id: taskId, done_by: doneBy, done_date: doneDate || new Date().toISOString().split("T")[0] })
        .select("id, task_id, done_date, done_by")
        .single();
      if (dbError) throw dbError;
      if (data) setLogs(prev => [data as CleaningLog, ...prev]);
    } catch {
      setError("Impossible d'enregistrer la validation.");
    }
  };

  const deleteLog = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("cleaning_logs").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch {
      setError("Impossible de supprimer le log.");
    }
  };

  return { tasks, logs, loading, error, addTask, deleteTask, logDone, deleteLog, retry: fetchAll };
}
