import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  nom: string;
  categorie: string;
  fab: string;
  dlc: string;
  quantite: string;
}

export function useProducts(userId: string | undefined) {
  const [produits, setProduits] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("products")
      .select("id, nom, categorie, fab, dlc, quantite")
      .eq("user_id", userId)
      .order("dlc", { ascending: true });
    if (!error && data) {
      setProduits(data.map(p => ({
        id: p.id,
        nom: p.nom,
        categorie: p.categorie,
        fab: p.fab || "",
        dlc: p.dlc,
        quantite: p.quantite || "",
      })));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = async (product: Omit<Product, "id">) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("products")
      .insert({ user_id: userId, nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null })
      .select("id, nom, categorie, fab, dlc, quantite")
      .single();
    if (!error && data) {
      setProduits(prev => [...prev, { ...data, fab: data.fab || "", quantite: data.quantite || "" }]);
    }
  };

  const updateProduct = async (id: string, product: Omit<Product, "id">) => {
    if (!userId) return;
    const { error } = await supabase
      .from("products")
      .update({ nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null })
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setProduits(prev => prev.map(p => p.id === id ? { id, ...product } : p));
    }
  };

  const deleteProduct = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", userId);
    if (!error) setProduits(prev => prev.filter(p => p.id !== id));
  };

  return { produits, loading, addProduct, updateProduct, deleteProduct };
}
