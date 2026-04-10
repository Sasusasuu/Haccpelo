// Shared PIN hashing/verification utilities — single source of truth
const HASH_PIN_URL = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hash-pin`;
const AUTH_HEADERS = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
});

export async function hashPinRemote(pin: string): Promise<string> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "hash", pin }),
  });
  if (!res.ok) throw new Error("Failed to hash PIN");
  const data = await res.json();
  return data.hash;
}

export async function verifyPinRemote(pin: string, hash: string): Promise<boolean> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "verify", pin, hash }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid === true;
}
