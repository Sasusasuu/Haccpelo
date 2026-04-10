import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EstablishmentProfile {
  establishment_name: string;
  siret: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  manager_name: string;
  onboarding_completed: boolean;
  manager_pin_hash: string | null;
  cgu_accepted_at: string | null;
  cgv_accepted_at: string | null;
  privacy_policy_accepted_at: string | null;
  legal_documents_version: string | null;
  subscription_status: string;
}

const DEFAULT_PROFILE: EstablishmentProfile = {
  establishment_name: "Mon établissement",
  siret: "",
  email: "",
  phone: "",
  address: "",
  postal_code: "",
  city: "",
  manager_name: "",
  onboarding_completed: false,
  manager_pin_hash: null,
  cgu_accepted_at: null,
  cgv_accepted_at: null,
  privacy_policy_accepted_at: null,
  legal_documents_version: null,
  subscription_status: "starter",
};

export function useEstablishmentName(userId: string | undefined) {
  const [profile, setProfile] = useState<EstablishmentProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("settings")
        .select("establishment_name, siret, email, phone, address, postal_code, city, manager_name, onboarding_completed, manager_pin_hash, cgu_accepted_at, cgv_accepted_at, privacy_policy_accepted_at, legal_documents_version, subscription_status")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setProfile({
          establishment_name: (data as any).establishment_name || DEFAULT_PROFILE.establishment_name,
          siret: (data as any).siret || "",
          email: (data as any).email || "",
          phone: (data as any).phone || "",
          address: (data as any).address || "",
          postal_code: (data as any).postal_code || "",
          city: (data as any).city || "",
          manager_name: (data as any).manager_name || "",
          onboarding_completed: (data as any).onboarding_completed ?? false,
          manager_pin_hash: (data as any).manager_pin_hash ?? null,
          cgu_accepted_at: (data as any).cgu_accepted_at ?? null,
          cgv_accepted_at: (data as any).cgv_accepted_at ?? null,
          privacy_policy_accepted_at: (data as any).privacy_policy_accepted_at ?? null,
          legal_documents_version: (data as any).legal_documents_version ?? null,
          subscription_status: (data as any).subscription_status ?? "starter",
        });
      }
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
    if (!error) setProfile(prev => ({ ...prev, establishment_name: trimmed }));
  }, [userId]);

  const updateProfile = useCallback(async (updates: Partial<EstablishmentProfile>) => {
    if (!userId) return;
    const { error } = await supabase
      .from("settings")
      .update(updates as any)
      .eq("user_id", userId);
    if (!error) setProfile(prev => ({ ...prev, ...updates }));
  }, [userId]);

  return {
    establishmentName: profile.establishment_name,
    profile,
    updateName,
    updateProfile,
    loading,
    refetch: fetch_,
  };
}
