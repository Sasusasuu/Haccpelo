import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { nom, categorie, fab } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en sécurité alimentaire et HACCP. On te donne un produit alimentaire avec son nom, sa catégorie et sa date de fabrication. Tu dois suggérer une Date Limite de Consommation (DLC) réaliste basée sur les normes HACCP françaises pour la restauration.

Règles :
- Réponds UNIQUEMENT avec un JSON valide, rien d'autre.
- Format : {"dlc": "YYYY-MM-DD", "duree_jours": N, "categorie": "...", "explication": "..."}
- La DLC doit être une date au format YYYY-MM-DD
- duree_jours = nombre de jours entre fabrication et DLC
- categorie = la catégorie la plus adaptée parmi : Viande, Poisson, Produits laitiers, Légumes, Fruits, Charcuterie, Épicerie, Boissons, Autre
- explication = courte justification (1 phrase max)
- Aujourd'hui : ${today}
- Si pas de date de fabrication, utilise aujourd'hui comme référence.`
          },
          {
            role: "user",
            content: `Produit : "${nom}"\nCatégorie : "${categorie}"\nDate de fabrication : "${fab || today}"`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_dlc",
              description: "Suggest a DLC date for a food product",
              parameters: {
                type: "object",
                properties: {
                  dlc: { type: "string", description: "DLC date in YYYY-MM-DD format" },
                  duree_jours: { type: "number", description: "Number of days between fabrication and DLC" },
                  categorie: { type: "string", description: "Best matching category", enum: ["Viande","Poisson","Produits laitiers","Légumes","Fruits","Charcuterie","Épicerie","Boissons","Autre"] },
                  explication: { type: "string", description: "Short explanation for the suggested DLC" }
                },
                required: ["dlc", "duree_jours", "categorie", "explication"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_dlc" } }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
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
