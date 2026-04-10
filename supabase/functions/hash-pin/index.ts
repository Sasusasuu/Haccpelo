import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getAllowedOrigins(): string[] {
  const origins: string[] = [
    "https://id-preview--13900d90-7c22-443b-a791-caa074dd8c0a.lovable.app",
  ];
  const env = Deno.env.get("ALLOWED_ORIGIN");
  if (env) origins.push(...env.split(",").map(o => o.trim()).filter(Boolean));
  const siteUrl = Deno.env.get("SITE_URL");
  if (siteUrl) origins.push(siteUrl.replace(/\/$/, ""));
  return [...new Set(origins)];
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS, "Vary": "Origin" };
  }
  return { "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS };
}

function forbiddenResponse() {
  return new Response(JSON.stringify({ error: "Origin not allowed" }), {
    status: 403, headers: { "Content-Type": "application/json" },
  });
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

function rateLimitResponse() {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      if (!checkRateLimit(`emp:${employee_id}`)) return rateLimitResponse();
      const supabase = getServiceClient();
      const { data, error } = await supabase.from("employees").select("pin_hash").eq("id", employee_id).single();
      if (error || !data?.pin_hash) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Legacy short hashes — force re-set
      if (!data.pin_hash.includes(":")) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPin(pin, data.pin_hash);
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
      if (!checkRateLimit(`mgr:${user_id}`)) return rateLimitResponse();
      const supabase = getServiceClient();
      const { data, error } = await supabase.from("settings").select("manager_pin_hash").eq("user_id", user_id).single();
      if (error || !data?.manager_pin_hash) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!data.manager_pin_hash.includes(":")) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = await verifyPin(pin, data.manager_pin_hash);
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
      if (!checkRateLimit(`idpin:${user_id}`)) return rateLimitResponse();
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
            return new Response(JSON.stringify({ found: true, employee_id: emp.id }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
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
