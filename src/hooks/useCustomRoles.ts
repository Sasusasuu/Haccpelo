import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomRole {
  id: string;
  label: string;
  color: string;
}

const DEFAULT_ROLES: Omit<CustomRole, "id">[] = [
  { label: "Runner", color: "#2563eb" },
  { label: "Chef de salle", color: "#7c3aed" },
  { label: "Cuisinier", color: "#dc2626" },
  { label: "Barman", color: "#d97706" },
  { label: "Plongeur", color: "#0891b2" },
  { label: "Serveur", color: "#16a34a" },
];

export function useCustomRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("custom_roles")
      .select("id, label, color")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      if (data.length === 0) {
        // Seed defaults
        const rows = DEFAULT_ROLES.map(r => ({ user_id: userId, label: r.label, color: r.color }));
        const { data: seeded } = await supabase
          .from("custom_roles")
          .insert(rows)
          .select("id, label, color");
        if (seeded) setRoles(seeded);
      } else {
        setRoles(data);
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const addRole = async (label: string, color: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("custom_roles")
      .insert({ user_id: userId, label, color })
      .select("id, label, color")
      .single();
    if (!error && data) setRoles(prev => [...prev, data]);
  };

  const updateRole = async (id: string, updates: Partial<Pick<CustomRole, "label" | "color">>) => {
    if (!userId) return;
    const { error } = await supabase
      .from("custom_roles")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) setRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRole = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("custom_roles")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) setRoles(prev => prev.filter(r => r.id !== id));
  };

  return { roles, loading, addRole, updateRole, deleteRole };
}
