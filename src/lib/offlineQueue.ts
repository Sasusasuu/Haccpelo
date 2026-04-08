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

async function replayMutation(mutation: QueuedMutation): Promise<void> {
  const { table, type, payload, matchColumn, matchValue } = mutation;

  // Use raw REST call to bypass strict typing for dynamic table names
  const client = supabase as any;
  let result: { error: any };

  switch (type) {
    case "insert":
      result = await client.from(table).insert(payload);
      break;
    case "upsert":
      result = await client.from(table).upsert(payload);
      break;
    case "update":
      result = await client.from(table).update(payload).eq(matchColumn!, matchValue);
      break;
    case "delete":
      result = await client.from(table).delete().eq(matchColumn!, matchValue);
      break;
    default:
      throw new Error(`Unknown mutation type: ${type}`);
  }

  if (result.error) throw result.error;
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
      await replayMutation(mutation);
      await del(key);
      success++;
    } catch (err) {
      console.error("[OfflineQueue] Failed to replay mutation", mutation, err);
      failed++;
    }
  }

  return { success, failed };
}
