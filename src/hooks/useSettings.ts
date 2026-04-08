import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = (h * 33) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function useSettings(userId: string | undefined) {
  const [managerPinHash, setManagerPinHash] = useState<string>(hashPin("1234"));
  const [planningSessionMinutes, setPlanningSessionMinutes] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("settings")
        .select("manager_pin_hash, planning_session_minutes")
        .eq("user_id", userId)
        .single();
      if (dbError && dbError.code === "PGRST116") {
        await supabase.from("settings").insert({ user_id: userId, manager_pin_hash: hashPin("1234") });
      } else if (dbError) {
        throw dbError;
      } else {
        if (data?.manager_pin_hash) setManagerPinHash(data.manager_pin_hash);
        if (data?.planning_session_minutes != null) setPlanningSessionMinutes(data.planning_session_minutes);
      }
    } catch {
      setError("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const verifyPin = (pin: string) => hashPin(pin) === managerPinHash;

  const changePin = async (newPin: string) => {
    if (!userId) return;
    try {
      const newHash = hashPin(newPin);
      const { error: dbError } = await supabase
        .from("settings")
        .update({ manager_pin_hash: newHash })
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setManagerPinHash(newHash);
    } catch {
      setError("Impossible de changer le code PIN.");
    }
  };

  const updateSessionMinutes = async (minutes: number) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase
        .from("settings")
        .update({ planning_session_minutes: minutes } as any)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setPlanningSessionMinutes(minutes);
    } catch {
      setError("Impossible de modifier la durée de session.");
    }
  };

  return { verifyPin, changePin, planningSessionMinutes, updateSessionMinutes, loading, error, retry: fetchSettings };
}
