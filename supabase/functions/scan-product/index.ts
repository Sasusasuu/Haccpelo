import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url } = await req.json();
    if (!image_url) throw new Error("image_url is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];
    const categories = ["Viande","Poisson","Produits laitiers","Légumes","Fruits","Charcuterie","Épicerie","Boissons","Autre"];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en traçabilité alimentaire et HACCP. Analyse cette photo d'un produit alimentaire (emballage, étiquette, produit brut, bon de livraison, etc.) et extrais le MAXIMUM d'informations possibles.

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

Aujourd'hui : ${today}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse cette photo de produit alimentaire et extrais toutes les informations de traçabilité visibles." },
              { type: "image_url", image_url: { url: image_url } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "Extract traceability information from a food product photo",
              parameters: {
                type: "object",
                properties: {
                  nom: { type: "string", description: "Product name" },
                  categorie: { type: "string", enum: categories },
                  fab: { type: "string", description: "Fabrication date YYYY-MM-DD or empty" },
                  dlc: { type: "string", description: "DLC date YYYY-MM-DD or empty" },
                  lot: { type: "string", description: "Lot number or empty" },
                  fournisseur: { type: "string", description: "Supplier/brand or empty" },
                  poids: { type: "string", description: "Weight/quantity or empty" },
                  temperature: { type: "string", description: "Temperature or empty" },
                  origine: { type: "string", description: "Origin country/region or empty" },
                  ingredients: { type: "string", description: "Summarized ingredients or empty" },
                  allergenes: { type: "string", description: "Allergens or empty" },
                  observations: { type: "string", description: "Other relevant info or empty" }
                },
                required: ["nom", "categorie"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_product_info" } }
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

    return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-product error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
