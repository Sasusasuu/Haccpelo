import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verifyEmployeePinRemote, hashPinRemote } from "@/lib/pinUtils";

export interface Employee {
  id: string;
  name: string;
  contract_hours: number | null;
  meal_type: string | null;
  has_pin: boolean;
  has_nfc: boolean;
  is_manager: boolean;
}

export async function verifyEmployeePin(employeeId: string, pin: string): Promise<boolean> {
  return verifyEmployeePinRemote(employeeId, pin);
}

export async function hashEmployeePin(pin: string): Promise<string> {
  return hashPinRemote(pin);
}

export function useEmployees(userId: string | undefined) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapEmployee = (row: any): Employee => ({
    id: row.id,
    name: row.name,
    contract_hours: row.contract_hours,
    meal_type: row.meal_type,
    has_pin: !!row.has_pin,
    has_nfc: !!row.has_nfc,
    is_manager: row.is_manager,
  });

  const fetchEmployees = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("employees")
        .select("id, name, contract_hours, meal_type, has_pin, has_nfc, is_manager")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (dbError) throw dbError;
      if (data) setEmployees(data.map(mapEmployee));
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
        .select("id, name, contract_hours, meal_type, has_pin, has_nfc, is_manager")
        .single();
      if (dbError) throw dbError;
      if (data) setEmployees(prev => [...prev, mapEmployee(data)]);
    } catch {
      setError("Impossible d'ajouter l'employé.");
    }
  };

  const setEmployeePin = async (id: string, hashedPin: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("employees")
        .update({ pin_hash: hashedPin } as any)
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, has_pin: true } : e));
    } catch {
      setError("Impossible de modifier le PIN.");
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Pick<Employee, "name" | "contract_hours" | "meal_type" | "is_manager">> & { nfc_badge_id?: string | null }) => {
    if (!userId) return;
    setError(null);
    try {
      const dbUpdates: {
        name?: string; contract_hours?: number | null; meal_type?: string | null;
        is_manager?: boolean; nfc_badge_id?: string | null;
      } = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.contract_hours !== undefined) dbUpdates.contract_hours = updates.contract_hours;
      if (updates.meal_type !== undefined) dbUpdates.meal_type = updates.meal_type;
      if (updates.is_manager !== undefined) dbUpdates.is_manager = updates.is_manager;
      if (updates.nfc_badge_id !== undefined) dbUpdates.nfc_badge_id = updates.nfc_badge_id;

      const { error: dbError } = await supabase
        .from("employees")
        .update(dbUpdates)
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;

      setEmployees(prev => prev.map(e => {
        if (e.id !== id) return e;
        const updated = { ...e };
        if (updates.name !== undefined) updated.name = updates.name;
        if (updates.contract_hours !== undefined) updated.contract_hours = updates.contract_hours;
        if (updates.meal_type !== undefined) updated.meal_type = updates.meal_type;
        if (updates.is_manager !== undefined) updated.is_manager = updates.is_manager;
        if (updates.nfc_badge_id !== undefined) updated.has_nfc = !!updates.nfc_badge_id;
        return updated;
      }));
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

  return { employees, loading, error, addEmployee, updateEmployee, setEmployeePin, deleteEmployee, retry: fetchEmployees };
}
