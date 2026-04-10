import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogProduct {
  id: string;
  product_name: string;
  default_dlc_days: number;
  category: string;
}

export function useProductCatalog(userId: string | undefined) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("product_catalog")
        .select("id, product_name, default_dlc_days, category")
        .eq("user_id", userId)
        .order("product_name", { ascending: true });
      if (dbError) throw dbError;
      if (data) setItems(data);
    } catch {
      setError("Impossible de charger le catalogue.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (product_name: string, default_dlc_days: number, category: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("product_catalog")
        .insert({ user_id: userId, product_name, default_dlc_days, category })
        .select("id, product_name, default_dlc_days, category")
        .single();
      if (dbError) {
        if (dbError.code === "23505") {
          setError("Ce produit existe déjà dans le catalogue.");
          return;
        }
        throw dbError;
      }
      if (data) setItems(prev => [...prev, data].sort((a, b) => a.product_name.localeCompare(b.product_name)));
    } catch {
      setError("Impossible d'ajouter le produit.");
    }
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("product_catalog")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      setError("Impossible de supprimer le produit.");
    }
  };

  /** Find matching catalog products by prefix */
  const findMatches = useCallback((query: string): CatalogProduct[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return items.filter(i => i.product_name.toLowerCase().includes(q));
  }, [items]);

  return { items, loading, error, addItem, deleteItem, findMatches, retry: fetchItems };
}
