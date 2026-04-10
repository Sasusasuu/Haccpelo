import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Employee {
  id: string;
  name: string;
  contract_hours: number | null;
  meal_type: string | null;
  nfc_badge_id: string | null;
  pin_hash: string | null;
  is_manager: boolean;
}

async function hashPinRemote(pin: string): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hash-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action: "hash", pin }),
  });
  if (!res.ok) throw new Error("Failed to hash PIN");
  const data = await res.json();
  return data.hash;
}

async function verifyPinRemote(pin: string, hash: string): Promise<boolean> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hash-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action: "verify", pin, hash }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid === true;
}

export async function verifyEmployeePin(employee: Employee, pin: string): Promise<boolean> {
  if (!employee.pin_hash) return false;
  return verifyPinRemote(pin, employee.pin_hash);
}

export async function hashEmployeePin(pin: string): Promise<string> {
  return hashPinRemote(pin);
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
        .select("id, name, contract_hours, meal_type, nfc_badge_id, pin_hash, is_manager")
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
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("employees")
        .insert({ user_id: userId, name, contract_hours: contractHours ?? null })
        .select("id, name, contract_hours, meal_type, nfc_badge_id, pin_hash, is_manager")
        .single();
      if (dbError) throw dbError;
      if (data) setEmployees(prev => [...prev, data]);
    } catch {
      setError("Impossible d'ajouter l'employé.");
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Pick<Employee, "name" | "contract_hours" | "meal_type" | "nfc_badge_id" | "pin_hash" | "is_manager">>) => {
    if (!userId) return;
    setError(null);
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
    setError(null);
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
