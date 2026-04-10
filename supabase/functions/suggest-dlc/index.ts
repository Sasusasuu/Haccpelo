import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
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
    const { nom, categorie, fab } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Tu es un expert en sécurité alimentaire et HACCP. On te donne un produit alimentaire avec son nom, sa catégorie et sa date de fabrication. Tu dois suggérer une Date Limite de Consommation (DLC) réaliste basée sur les normes HACCP françaises pour la restauration.

Règles :
- Réponds UNIQUEMENT avec un JSON valide, rien d'autre.
- Format : {"dlc": "YYYY-MM-DD", "duree_jours": N, "categorie": "...", "explication": "..."}
- La DLC doit être une date au format YYYY-MM-DD
- duree_jours = nombre de jours entre fabrication et DLC
- categorie = la catégorie la plus adaptée parmi : Viande, Poisson, Produits laitiers, Légumes, Fruits, Charcuterie, Épicerie, Boissons, Autre
- explication = courte justification (1 phrase max)
- Aujourd'hui : ${today}
- Si pas de date de fabrication, utilise aujourd'hui comme référence.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Produit : "${nom}"\nCatégorie : "${categorie}"\nDate de fabrication : "${fab || today}"` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("JSON parse failed:", jsonMatch[0]);
      }
    }

    return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-dlc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
