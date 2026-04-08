import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nom, categorie, fab } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Produit : "${nom}"\nCatégorie : "${categorie}"\nDate de fabrication : "${fab || today}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-dlc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
