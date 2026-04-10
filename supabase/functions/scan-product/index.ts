import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { image_url } = await req.json();

    // --- Input validation ---
    if (!image_url || typeof image_url !== "string") {
      return new Response(JSON.stringify({ error: "image_url est requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!image_url.startsWith("https://")) {
      return new Response(JSON.stringify({ error: "image_url doit utiliser HTTPS" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const urlHost = new URL(image_url).hostname;
    if (!urlHost.endsWith(".supabase.co")) {
      return new Response(JSON.stringify({ error: "image_url doit pointer vers le storage Supabase (*.supabase.co)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check image size via HEAD request (max 10 MB)
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    try {
      const headRes = await fetch(image_url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      const contentLength = headRes.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: "L'image dépasse la taille maximale de 10 MB" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // HEAD failed — proceed anyway, AI gateway will reject if too large
    }

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
