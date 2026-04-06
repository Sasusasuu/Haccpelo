import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = (h * 33) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function useSettings(userId: string | undefined) {
  const [managerPinHash, setManagerPinHash] = useState<string>(hashPin("1234"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("settings")
        .select("manager_pin_hash")
        .eq("user_id", userId)
        .single();
      if (dbError && dbError.code === "PGRST116") {
        await supabase.from("settings").insert({ user_id: userId, manager_pin_hash: hashPin("1234") });
      } else if (dbError) {
        throw dbError;
      } else if (data?.manager_pin_hash) {
        setManagerPinHash(data.manager_pin_hash);
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

  return { verifyPin, changePin, loading, error, retry: fetchSettings };
}
