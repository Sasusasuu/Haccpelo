import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useEstablishmentName(userId: string | undefined) {
  const [establishmentName, setEstablishmentName] = useState("Mon établissement");
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("settings")
        .select("establishment_name")
        .eq("user_id", userId)
        .single();
      if (data?.establishment_name) setEstablishmentName(data.establishment_name);
    } catch {}
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const updateName = useCallback(async (name: string) => {
    if (!userId || !name.trim()) return;
    const trimmed = name.trim();
    const { error } = await supabase
      .from("settings")
      .update({ establishment_name: trimmed } as any)
      .eq("user_id", userId);
    if (!error) setEstablishmentName(trimmed);
  }, [userId]);

  return { establishmentName, updateName, loading };
}
