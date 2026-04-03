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

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("settings")
      .select("manager_pin_hash")
      .eq("user_id", userId)
      .single();
    if (!error && data?.manager_pin_hash) {
      setManagerPinHash(data.manager_pin_hash);
    } else if (error?.code === "PGRST116") {
      // No settings yet, create with default
      await supabase.from("settings").insert({ user_id: userId, manager_pin_hash: hashPin("1234") });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const verifyPin = (pin: string) => hashPin(pin) === managerPinHash;

  const changePin = async (newPin: string) => {
    if (!userId) return;
    const newHash = hashPin(newPin);
    const { error } = await supabase
      .from("settings")
      .update({ manager_pin_hash: newHash })
      .eq("user_id", userId);
    if (!error) setManagerPinHash(newHash);
  };

  return { verifyPin, changePin, loading };
}
