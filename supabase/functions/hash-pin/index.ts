import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
  Deno.env.get("SITE_URL") ?? "",
  "https://lovable.dev",
  "https://id-preview--13900d90-7c22-443b-a791-caa074dd8c0a.lovable.app",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const ITERATIONS = 100000;
const SALT_LENGTH = 16;

// --- Rate limiting (in-memory) ---
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function rateLimitResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Trop de tentatives, réessayez dans 60 secondes" }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBytes = new Uint8Array(derived);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const saltHex = parts[0];
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === parts[1];
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
// --- Audit logging (fire-and-forget, never blocks response) ---
async function logAudit(
  supabase: ReturnType<typeof getServiceClient>,
  params: { user_id?: string; employee_id?: string; action_type: string; description: string }
) {
  try {
    // user_id is required by the table — skip if missing
    if (!params.user_id) return;
    await supabase.from("audit_logs").insert({
      user_id: params.user_id,
      employee_id: params.employee_id || null,
      employee_name: null,
      action_type: params.action_type,
      category: "sécurité",
      description: params.description,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("audit_log insert failed:", e);
  }
}


  const corsHeaders = getCorsHeaders(req);
  const originAllowed = !!corsHeaders["Access-Control-Allow-Origin"];

  if (req.method === "OPTIONS") {
    return originAllowed
      ? new Response(null, { status: 204, headers: corsHeaders })
      : new Response(null, { status: 403 });
  }

  if (!originAllowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, pin } = body;

    // --- Action: hash (no DB needed) ---
    if (action === "hash") {
      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hashed = await hashPin(pin);
      return new Response(JSON.stringify({ hash: hashed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: verify_employee — verify PIN for a specific employee (server-side lookup) ---
    if (action === "verify_employee") {
      const { employee_id } = body;
      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!employee_id || typeof employee_id !== "string") {
        return new Response(JSON.stringify({ error: "employee_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!checkRateLimit(`emp:${employee_id}`)) {
        const sb = getServiceClient();
        logAudit(sb, { employee_id, action_type: "pin_rate_limited", description: "Rate limit dépassé pour vérification PIN employé" });
        return rateLimitResponse(corsHeaders);
      }
      const supabase = getServiceClient();
      const { data, error } = await supabase.from("employees").select("pin_hash, user_id").eq("id", employee_id).single();
      if (error || !data?.pin_hash) {
        logAudit(supabase, { user_id: data?.user_id, employee_id, action_type: "pin_failed", description: "Vérification PIN employé échouée (pas de hash)" });
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!data.pin_hash.includes(":")) {
        logAudit(supabase, { user_id: data.user_id, employee_id, action_type: "pin_failed", description: "Vérification PIN employé échouée (hash legacy)" });
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPin(pin, data.pin_hash);
      logAudit(supabase, {
        user_id: data.user_id, employee_id,
        action_type: valid ? "pin_success" : "pin_failed",
        description: valid ? "Vérification PIN employé réussie" : "Vérification PIN employé échouée (code incorrect)",
      });
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: verify_manager — verify manager PIN for a user (server-side lookup) ---
    if (action === "verify_manager") {
      const { user_id } = body;
      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!checkRateLimit(`mgr:${user_id}`)) {
        const sb = getServiceClient();
        logAudit(sb, { user_id, action_type: "pin_rate_limited", description: "Rate limit dépassé pour vérification PIN manager" });
        return rateLimitResponse(corsHeaders);
      }
      const supabase = getServiceClient();
      const { data, error } = await supabase.from("settings").select("manager_pin_hash").eq("user_id", user_id).single();
      if (error || !data?.manager_pin_hash) {
        logAudit(supabase, { user_id, action_type: "pin_failed", description: "Vérification PIN manager échouée (pas de hash)" });
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!data.manager_pin_hash.includes(":")) {
        logAudit(supabase, { user_id, action_type: "pin_failed", description: "Vérification PIN manager échouée (hash legacy)" });
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPin(pin, data.manager_pin_hash);
      logAudit(supabase, {
        user_id,
        action_type: valid ? "pin_success" : "pin_failed",
        description: valid ? "Vérification PIN manager réussie" : "Vérification PIN manager échouée (code incorrect)",
      });
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: identify_pin — find which employee matches a PIN (for a given user_id, optionally managers_only) ---
    if (action === "identify_pin") {
      const { user_id, managers_only } = body;
      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!checkRateLimit(`idpin:${user_id}`)) {
        const sb = getServiceClient();
        logAudit(sb, { user_id, action_type: "pin_rate_limited", description: "Rate limit dépassé pour identification PIN" });
        return rateLimitResponse(corsHeaders);
      }
      const supabase = getServiceClient();
      let query = supabase.from("employees").select("id, pin_hash, is_manager").eq("user_id", user_id);
      if (managers_only) query = query.eq("is_manager", true);
      const { data: employees } = await query;
      if (!employees) {
        return new Response(JSON.stringify({ found: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const emp of employees) {
        if (emp.pin_hash && emp.pin_hash.includes(":")) {
          const valid = await verifyPin(pin, emp.pin_hash);
          if (valid) {
            logAudit(supabase, { user_id, employee_id: emp.id, action_type: "pin_success", description: "Identification par PIN réussie" });
            return new Response(JSON.stringify({ found: true, employee_id: emp.id }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
      logAudit(supabase, { user_id, action_type: "pin_failed", description: "Identification par PIN échouée (aucun employé correspondant)" });
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: match_nfc — find employee by NFC badge ID (server-side) ---
    if (action === "match_nfc") {
      const { user_id, badge_id, managers_only } = body;
      if (!user_id || !badge_id) {
        return new Response(JSON.stringify({ error: "user_id and badge_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = getServiceClient();
      let query = supabase.from("employees").select("id, name, is_manager").eq("user_id", user_id).eq("nfc_badge_id", badge_id);
      if (managers_only) query = query.eq("is_manager", true);
      const { data } = await query;
      if (data && data.length > 0) {
        return new Response(JSON.stringify({ found: true, employee_id: data[0].id, employee_name: data[0].name }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Legacy action: verify (hash passed from client — kept for backward compat but discouraged) ---
    if (action === "verify") {
      const { hash } = body;
      if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!hash || typeof hash !== "string") {
        return new Response(JSON.stringify({ error: "hash is required for verify" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!hash.includes(":")) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPin(pin, hash);
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action must be 'hash', 'verify_employee', 'verify_manager', 'identify_pin', 'match_nfc', or 'verify'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hash-pin error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
