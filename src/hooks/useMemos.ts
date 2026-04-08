import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Memo {
  id: string;
  content: string;
  created_at: string;
}

export function useMemos(userId: string) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemos = useCallback(async () => {
    const { data, error } = await supabase
      .from("memos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur chargement pense-bêtes");
    } else {
      setMemos(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchMemos(); }, [fetchMemos]);

  const addMemo = useCallback(async (content: string) => {
    const { data, error } = await supabase
      .from("memos")
      .insert({ user_id: userId, content })
      .select()
      .single();
    if (error) {
      toast.error("Erreur ajout pense-bête");
    } else if (data) {
      setMemos(prev => [data, ...prev]);
      toast.success("Pense-bête ajouté");
    }
  }, [userId]);

  const deleteMemo = useCallback(async (id: string) => {
    const { error } = await supabase.from("memos").delete().eq("id", id);
    if (error) {
      toast.error("Erreur suppression");
    } else {
      setMemos(prev => prev.filter(m => m.id !== id));
    }
  }, []);

  return { memos, loading, addMemo, deleteMemo };
}
