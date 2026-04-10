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
    const { image_url } = await req.json();
    if (!image_url) throw new Error("image_url is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];
    const categories = ["Viande","Poisson","Produits laitiers","Légumes","Fruits","Charcuterie","Épicerie","Boissons","Autre"];

    const systemPrompt = `Tu es un expert en traçabilité alimentaire et HACCP. Analyse cette photo d'un produit alimentaire (emballage, étiquette, produit brut, bon de livraison, etc.) et extrais le MAXIMUM d'informations possibles.

Extrais :
- nom : nom du produit (obligatoire, déduis-le si besoin)
- categorie : parmi ${categories.join(", ")}
- fab : date de fabrication au format YYYY-MM-DD (si visible)
- dlc : date limite de consommation au format YYYY-MM-DD (si visible)
- lot : numéro de lot (si visible)
- fournisseur : nom du fournisseur/marque (si visible)
- poids : poids/quantité (si visible)
- temperature : température de réception/stockage (si visible)
- origine : pays/région d'origine (si visible)
- ingredients : liste d'ingrédients résumée (si visible)
- allergenes : allergènes identifiés (si visible)
- observations : toute autre info pertinente pour la traçabilité

Réponds UNIQUEMENT avec un JSON valide contenant ces champs. Les champs non trouvés doivent être des chaînes vides.
Aujourd'hui : ${today}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image_url } },
              { type: "text", text: "Analyse cette photo de produit alimentaire et extrais toutes les informations de traçabilité visibles." },
            ],
          },
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
    console.error("scan-product error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
