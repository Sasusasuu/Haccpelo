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

  const fetchEquipments = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("equipments")
      .select("id, name, equipment_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!error && data) setEquipments(data as Equipment[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchEquipments(); }, [fetchEquipments]);

  const addEquipment = async (name: string, type: "frigo" | "congelateur") => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("equipments")
      .insert({ user_id: userId, name, equipment_type: type })
      .select("id, name, equipment_type")
      .single();
    if (!error && data) setEquipments(prev => [...prev, data as Equipment]);
  };

  const updateEquipment = async (id: string, name: string, type: "frigo" | "congelateur") => {
    if (!userId) return;
    const { error } = await supabase
      .from("equipments")
      .update({ name, equipment_type: type })
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) setEquipments(prev => prev.map(e => e.id === id ? { ...e, name, equipment_type: type } : e));
  };

  const deleteEquipment = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("equipments").delete().eq("id", id).eq("user_id", userId);
    if (!error) setEquipments(prev => prev.filter(e => e.id !== id));
  };

  return { equipments, loading, addEquipment, updateEquipment, deleteEquipment };
}
