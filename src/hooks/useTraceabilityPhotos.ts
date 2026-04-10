import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TraceabilityPhoto {
  id: string;
  product_name: string;
  categorie: string;
  photo_url: string;
  product_id: string | null;
  created_at: string;
}

export function useTraceabilityPhotos(userId: string | undefined) {
  const [photos, setPhotos] = useState<TraceabilityPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("traceability_photos")
        .select("id, product_name, categorie, photo_url, product_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (dbError) throw dbError;
      setPhotos(data ?? []);
    } catch {
      setError("Impossible de charger l'historique des photos.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const addPhoto = async (photo: { product_name: string; categorie: string; photo_url: string; product_id?: string }) => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("traceability_photos")
        .insert({
          user_id: userId,
          product_name: photo.product_name,
          categorie: photo.categorie,
          photo_url: photo.photo_url,
          product_id: photo.product_id ?? null,
        })
        .select("id, product_name, categorie, photo_url, product_id, created_at")
        .single();
      if (dbError) throw dbError;
      if (data) setPhotos(prev => [data, ...prev]);
    } catch {
      setError("Impossible d'enregistrer la photo de traçabilité.");
    }
  };

  return { photos, loading, error, addPhoto, retry: fetchPhotos };
}
