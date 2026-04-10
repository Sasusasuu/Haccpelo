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

/** Verify an employee's PIN server-side by employee_id (hash never leaves server) */
export async function verifyEmployeePinRemote(employeeId: string, pin: string): Promise<boolean> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "verify_employee", employee_id: employeeId, pin }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid === true;
}

/** Verify the manager PIN server-side by user_id (hash never leaves server) */
export async function verifyManagerPinRemote(userId: string, pin: string): Promise<boolean> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "verify_manager", user_id: userId, pin }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.valid === true;
}

/** Identify which employee matches a PIN (server-side). Returns employee_id or null. */
export async function identifyByPinRemote(userId: string, pin: string, managersOnly = false): Promise<string | null> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "identify_pin", user_id: userId, pin, managers_only: managersOnly }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.found ? data.employee_id : null;
}

/** Match NFC badge server-side. Returns {employee_id, employee_name} or null. */
export async function matchNfcRemote(userId: string, badgeId: string, managersOnly = false): Promise<{ employee_id: string; employee_name: string } | null> {
  const res = await fetch(HASH_PIN_URL(), {
    method: "POST",
    headers: AUTH_HEADERS(),
    body: JSON.stringify({ action: "match_nfc", user_id: userId, badge_id: badgeId, managers_only: managersOnly }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.found ? { employee_id: data.employee_id, employee_name: data.employee_name } : null;
}

// Legacy — kept for backward compat but prefer server-side methods above
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
