import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  nom: string;
  categorie: string;
  fab: string;
  dlc: string;
  quantite: string;
  photo_url: string;
}

export function useProducts(userId: string | undefined) {
  const [produits, setProduits] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("products")
      .select("id, nom, categorie, fab, dlc, quantite, photo_url")
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
        photo_url: p.photo_url || "",
      })));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file);
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const addProduct = async (product: Omit<Product, "id">) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("products")
      .insert({ user_id: userId, nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null, photo_url: product.photo_url || null })
      .select("id, nom, categorie, fab, dlc, quantite, photo_url")
      .single();
    if (!error && data) {
      setProduits(prev => [...prev, { ...data, fab: data.fab || "", quantite: data.quantite || "", photo_url: data.photo_url || "" }]);
    }
  };

  const updateProduct = async (id: string, product: Omit<Product, "id">) => {
    if (!userId) return;
    const { error } = await supabase
      .from("products")
      .update({ nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null, photo_url: product.photo_url || null })
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

  return { produits, loading, addProduct, updateProduct, deleteProduct, uploadPhoto };
}
