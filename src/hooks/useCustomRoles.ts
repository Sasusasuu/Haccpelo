import { useState, useEffect, useCallback, useRef } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const seeding = useRef(false);

  const fetchRoles = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("custom_roles")
        .select("id, label, color")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (dbError) throw dbError;
      if (data) {
        if (data.length === 0 && !seeding.current) {
          // Prevent race condition: mark seeding before insert
          seeding.current = true;
          try {
            const rows = DEFAULT_ROLES.map(r => ({ user_id: userId, label: r.label, color: r.color }));
            const { data: seeded, error: seedErr } = await supabase
              .from("custom_roles")
              .insert(rows)
              .select("id, label, color");
            if (seedErr) throw seedErr;
            if (seeded) setRoles(seeded);
          } finally {
            seeding.current = false;
          }
        } else {
          setRoles(data);
        }
      }
    } catch {
      setError("Impossible de charger les rôles. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const addRole = async (label: string, color: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("custom_roles")
        .insert({ user_id: userId, label, color })
        .select("id, label, color")
        .single();
      if (dbError) throw dbError;
      if (data) setRoles(prev => [...prev, data]);
    } catch {
      setError("Impossible d'ajouter le rôle.");
    }
  };

  const updateRole = async (id: string, updates: Partial<Pick<CustomRole, "label" | "color">>) => {
    if (!userId) return;
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("custom_roles")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    } catch {
      setError("Impossible de modifier le rôle.");
    }
  };

  const deleteRole = async (id: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setRoles(prev => prev.filter(r => r.id !== id));
    } catch {
      setError("Impossible de supprimer le rôle.");
    }
  };

  return { roles, loading, error, addRole, updateRole, deleteRole, retry: fetchRoles };
}
