import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";


export interface Product {
  id: string;
  nom: string;
  categorie: string;
  fab: string;
  dlc: string;
  quantite: string;
  photo_url: string;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 800,
  useWebWorker: true,
};

export function useProducts(userId: string | undefined) {
  const [produits, setProduits] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("products")
        .select("id, nom, categorie, fab, dlc, quantite, photo_url")
        .eq("user_id", userId)
        .order("dlc", { ascending: true });
      if (dbError) throw dbError;
      if (data) {
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
    } catch {
      setError("Impossible de charger les produits. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    if (!userId) return null;
    try {
      // Compress image before upload
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("product-photos").upload(path, compressed);
      if (uploadError) { setError("Erreur lors de l'envoi de la photo."); return null; }
      const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      setError("Erreur lors de la compression/envoi de la photo.");
      return null;
    }
  };

  const addProduct = async (product: Omit<Product, "id">) => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from("products")
        .insert({ user_id: userId, nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null, photo_url: product.photo_url || null })
        .select("id, nom, categorie, fab, dlc, quantite, photo_url")
        .single();
      if (dbError) throw dbError;
      if (data) {
        setProduits(prev => [...prev, { ...data, fab: data.fab || "", quantite: data.quantite || "", photo_url: data.photo_url || "" }]);
        // Log photo to traceability history
        if (data.photo_url) {
          await supabase.from("traceability_photos").insert({
            user_id: userId,
            product_name: data.nom,
            categorie: data.categorie,
            photo_url: data.photo_url,
            product_id: data.id,
          });
        }
      }
    } catch {
      setError("Impossible d'ajouter le produit.");
    }
  };

  const updateProduct = async (id: string, product: Omit<Product, "id">) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase
        .from("products")
        .update({ nom: product.nom, categorie: product.categorie, fab: product.fab || null, dlc: product.dlc, quantite: product.quantite || null, photo_url: product.photo_url || null })
        .eq("id", id)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      setProduits(prev => prev.map(p => p.id === id ? { id, ...product } : p));
    } catch {
      setError("Impossible de modifier le produit.");
    }
  };

  const deleteProduct = async (id: string) => {
    if (!userId) return;
    try {
      const { error: dbError } = await supabase.from("products").delete().eq("id", id).eq("user_id", userId);
      if (dbError) throw dbError;
      setProduits(prev => prev.filter(p => p.id !== id));
    } catch {
      setError("Impossible de supprimer le produit.");
    }
  };

  return { produits, loading, error, addProduct, updateProduct, deleteProduct, uploadPhoto, retry: fetchProducts };
}
