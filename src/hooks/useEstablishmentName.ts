import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

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
  manager_pin_configured: boolean;
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
  manager_pin_configured: false,
  cgu_accepted_at: null,
  cgv_accepted_at: null,
  privacy_policy_accepted_at: null,
  legal_documents_version: null,
  subscription_status: "starter",
};

function toSettingsPayload(updates: Partial<EstablishmentProfile>): TablesUpdate<"settings"> {
  return {
    establishment_name: updates.establishment_name,
    siret: updates.siret,
    email: updates.email,
    phone: updates.phone,
    address: updates.address,
    postal_code: updates.postal_code,
    city: updates.city,
    manager_name: updates.manager_name,
    onboarding_completed: updates.onboarding_completed,
    manager_pin_configured: (updates as any).manager_pin_configured,
    cgu_accepted_at: updates.cgu_accepted_at,
    cgv_accepted_at: updates.cgv_accepted_at,
    privacy_policy_accepted_at: updates.privacy_policy_accepted_at,
    legal_documents_version: updates.legal_documents_version,
    subscription_status: updates.subscription_status,
  };
}

export function useEstablishmentName(userId: string | undefined) {
  const [profile, setProfile] = useState<EstablishmentProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("settings")
        .select("establishment_name, siret, email, phone, address, postal_code, city, manager_name, onboarding_completed, manager_pin_configured, cgu_accepted_at, cgv_accepted_at, privacy_policy_accepted_at, legal_documents_version, subscription_status")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setProfile({
          establishment_name: data.establishment_name ?? DEFAULT_PROFILE.establishment_name,
          siret: data.siret ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          postal_code: data.postal_code ?? "",
          city: data.city ?? "",
          manager_name: data.manager_name ?? "",
          onboarding_completed: data.onboarding_completed ?? false,
          manager_pin_configured: !!(data as any).manager_pin_configured,
          cgu_accepted_at: data.cgu_accepted_at ?? null,
          cgv_accepted_at: data.cgv_accepted_at ?? null,
          privacy_policy_accepted_at: data.privacy_policy_accepted_at ?? null,
          legal_documents_version: data.legal_documents_version ?? null,
          subscription_status: data.subscription_status ?? "starter",
        });
      }
    } catch (error) {
      console.error("[useEstablishmentName] fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const persistProfile = useCallback(async (updates: Partial<EstablishmentProfile>) => {
    if (!userId) {
      return { error: new Error("Missing user id") };
    }

    const payload = toSettingsPayload(updates);
    const { data: existingRow, error: existingRowError } = await supabase
      .from("settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRowError) {
      return { error: existingRowError };
    }

    if (existingRow) {
      return supabase
        .from("settings")
        .update(payload)
        .eq("id", existingRow.id);
    }

    const insertPayload: TablesInsert<"settings"> = {
      user_id: userId,
      ...payload,
    };

    return supabase
      .from("settings")
      .insert(insertPayload);
  }, [userId]);

  const updateName = useCallback(async (name: string) => {
    if (!userId || !name.trim()) return;
    const trimmed = name.trim();
    const { error } = await persistProfile({ establishment_name: trimmed });
    if (!error) {
      setProfile(prev => ({ ...prev, establishment_name: trimmed }));
    }
  }, [persistProfile, userId]);

  const updateProfile = useCallback(async (updates: Partial<EstablishmentProfile>) => {
    if (!userId) return;
    const { error } = await persistProfile(updates);
    if (!error) {
      setProfile(prev => ({ ...prev, ...updates }));
    }
  }, [persistProfile, userId]);

  return {
    establishmentName: profile.establishment_name,
    profile,
    updateName,
    updateProfile,
    loading,
    refetch: fetch_,
  };
}
