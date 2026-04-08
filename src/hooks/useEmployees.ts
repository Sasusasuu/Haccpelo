import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Employee {
  id: string;
  name: string;
  contract_hours: number | null;
  meal_type: string | null;
  nfc_badge_id: string | null;
}

export function useEmployees(userId: string | undefined) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("employees")
.select("id, name, contract_hours, meal_type, nfc_badge_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (dbError) throw dbError;
      if (data) setEmployees(data);
    } catch {
      setError("Impossible de charger les employés. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const addEmployee = async (name: string, contractHours?: number) => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("employees")
        .insert({ user_id: userId, name, contract_hours: contractHours ?? null })
.select("id, name, contract_hours, meal_type, nfc_badge_id")
        .single();
      if (dbError) throw dbError;
      if (data) setEmployees(prev => [...prev, data]);
    } catch {
      setError("Impossible d'ajouter l'employé.");
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Pick<Employee, "name" | "contract_hours" | "meal_type">>) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase
        .from("employees")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    } catch {
      setError("Impossible de modifier l'employé.");
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("employees").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch {
      setError("Impossible de supprimer l'employé.");
    }
  };

  return { employees, loading, error, addEmployee, updateEmployee, deleteEmployee, retry: fetchEmployees };
}
