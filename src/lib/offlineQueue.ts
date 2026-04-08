import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

export interface QueuedMutation {
  id: string;
  table: string;
  type: "insert" | "update" | "delete" | "upsert";
  payload: Record<string, unknown>;
  matchColumn?: string;
  matchValue?: unknown;
  createdAt: number;
}

const QUEUE_PREFIX = "offline_mut_";

function mutationKey(id: string) {
  return `${QUEUE_PREFIX}${id}`;
}

export async function enqueue(mutation: Omit<QueuedMutation, "id" | "createdAt">) {
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await set(mutationKey(entry.id), entry);
  return entry;
}

export async function getPendingCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX)).length;
}

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const allKeys = await keys();
  const mutationKeys = allKeys
    .filter((k) => String(k).startsWith(QUEUE_PREFIX))
    .sort();

  let success = 0;
  let failed = 0;

  for (const key of mutationKeys) {
    const mutation = (await get(key)) as QueuedMutation;
    if (!mutation) continue;

    try {
      let query: any;
      switch (mutation.type) {
        case "insert":
          query = supabase.from(mutation.table).insert(mutation.payload as any);
          break;
        case "upsert":
          query = supabase.from(mutation.table).upsert(mutation.payload as any);
          break;
        case "update":
          query = supabase
            .from(mutation.table)
            .update(mutation.payload as any)
            .eq(mutation.matchColumn!, mutation.matchValue as any);
          break;
        case "delete":
          query = supabase
            .from(mutation.table)
            .delete()
            .eq(mutation.matchColumn!, mutation.matchValue as any);
          break;
      }

      const { error } = await query;
      if (error) throw error;

      await del(key);
      success++;
    } catch (err) {
      console.error("[OfflineQueue] Failed to replay mutation", mutation, err);
      failed++;
    }
  }

  return { success, failed };
}
