import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Employee {
  id: string;
  name: string;
  contract_hours: number | null;
  meal_type: string | null;
}

export function useEmployees(userId: string | undefined) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, contract_hours, meal_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!error && data) setEmployees(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const addEmployee = async (name: string, contractHours?: number) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("employees")
      .insert({ user_id: userId, name, contract_hours: contractHours ?? null })
      .select("id, name, contract_hours, meal_type")
      .single();
    if (!error && data) setEmployees(prev => [...prev, data]);
  };

  const updateEmployee = async (id: string, updates: Partial<Pick<Employee, "name" | "contract_hours" | "meal_type">>) => {
    if (!userId) return;
    const { error } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEmployee = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("employees").delete().eq("id", id).eq("user_id", userId);
    if (!error) setEmployees(prev => prev.filter(e => e.id !== id));
  };

  return { employees, loading, addEmployee, updateEmployee, deleteEmployee };
}
