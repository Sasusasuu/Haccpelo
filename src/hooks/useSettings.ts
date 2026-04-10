import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPinRemote, verifyPinRemote } from "@/lib/pinUtils";

export function useSettings(userId: string | undefined) {
  const [managerPinHash, setManagerPinHash] = useState<string | null>(null);
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
        .maybeSingle();
      if (dbError && dbError.code === "PGRST116") {
        await supabase.from("settings").insert({ user_id: userId });
        setManagerPinHash(null);
      } else if (dbError) {
        throw dbError;
      } else {
        if (data?.planning_session_minutes != null) setPlanningSessionMinutes(data.planning_session_minutes);
        setManagerPinHash(data?.manager_pin_hash ?? null);
      }
    } catch {
      setError("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const verifyPin = async (pin: string): Promise<boolean> => {
    if (!managerPinHash) return false;
    return verifyPinRemote(pin, managerPinHash);
  };

  const changePin = async (newPin: string) => {
    if (!userId) return;
    if (!/^\d{4}$/.test(newPin)) {
      setError("Le code PIN doit contenir exactement 4 chiffres.");
      return;
    }
    setError(null);
    try {
      const newHash = await hashPinRemote(newPin);
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
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("settings")
        .update({ planning_session_minutes: minutes })
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setPlanningSessionMinutes(minutes);
    } catch {
      setError("Impossible de modifier la durée de session.");
    }
  };

  return { verifyPin, changePin, planningSessionMinutes, updateSessionMinutes, loading, error, retry: fetchSettings };
}
