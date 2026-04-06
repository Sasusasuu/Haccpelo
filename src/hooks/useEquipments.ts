import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Equipment {
  id: string;
  name: string;
  equipment_type: "frigo" | "congelateur";
}

export function useEquipments(userId: string | undefined) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEquipments = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("equipments")
        .select("id, name, equipment_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (dbError) throw dbError;
      if (data) setEquipments(data as Equipment[]);
    } catch {
      setError("Impossible de charger les équipements. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchEquipments(); }, [fetchEquipments]);

  const addEquipment = async (name: string, type: "frigo" | "congelateur") => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("equipments")
        .insert({ user_id: userId, name, equipment_type: type })
        .select("id, name, equipment_type")
        .single();
      if (dbError) throw dbError;
      if (data) setEquipments(prev => [...prev, data as Equipment]);
    } catch {
      setError("Impossible d'ajouter l'équipement.");
    }
  };

  const updateEquipment = async (id: string, name: string, type: "frigo" | "congelateur") => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase
        .from("equipments")
        .update({ name, equipment_type: type })
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setEquipments(prev => prev.map(e => e.id === id ? { ...e, name, equipment_type: type } : e));
    } catch {
      setError("Impossible de modifier l'équipement.");
    }
  };

  const deleteEquipment = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("equipments").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setEquipments(prev => prev.filter(e => e.id !== id));
    } catch {
      setError("Impossible de supprimer l'équipement.");
    }
  };

  return { equipments, loading, error, addEquipment, updateEquipment, deleteEquipment, retry: fetchEquipments };
}
