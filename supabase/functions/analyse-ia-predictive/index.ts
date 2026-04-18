import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nikito.tech",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Tu es un expert en maintenance prédictive pour des parcs de loisirs indoor (trampolines, laser game, arcades, soft play).
Tu analyses les données de maintenance et tu retournes des prédictions et recommandations structurées.

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après, pas de backticks) avec cette structure exacte :

{
  "score_sante_global": number (0-100),
  "tendance": "stable" | "amelioration" | "degradation",
  "equipements_a_risque": [
    {
      "equipement_id": "string",
      "equipement_code": "string",
      "equipement_libelle": "string",
      "parc": "string",
      "score_risque": number (0-100, 100 = très risqué),
      "prediction": "string",
      "justification": "string",
      "action_recommandee": "string",
      "priorite": "haute" | "moyenne" | "basse",
      "date_panne_estimee": "YYYY-MM-DD"
    }
  ],
  "alertes": [
    {
      "type": "garantie_expiration" | "controle_manquant" | "stock_critique" | "certification_expiration" | "tendance_degradation",
      "message": "string",
      "parc": "string",
      "priorite": "haute" | "moyenne" | "basse"
    }
  ],
  "recommandations": [
    {
      "titre": "string",
      "description": "string",
      "impact_estime": "string",
      "cout_estime": "string",
      "deadline_suggeree": "YYYY-MM-DD"
    }
  ],
  "kpi_predictions": {
    "mtbf_prevu_30j": number,
    "incidents_prevus_30j": number,
    "taux_conformite_prevu": number,
    "equipements_necessitant_attention": number
  }
}

Règles :
- Trie les équipements à risque par score_risque décroissant
- Ne retourne que les équipements avec un risque réel (score > 40)
- Sois précis et factuel dans les justifications
- Base tes prédictions sur les tendances des données
- Les dates de panne estimées doivent être réalistes (dans les 30 prochains jours)
- Limite à 10 équipements à risque max, 10 alertes max, 5 recommandations max`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ANTHROPIC_API_KEY non configurée",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { maintenance_data } = await req.json();

    if (!maintenance_data) {
      return new Response(
        JSON.stringify({ success: false, error: "Données manquantes" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userMessage = `Voici les données de maintenance des 90 derniers jours au format JSON :\n\n${JSON.stringify(maintenance_data, null, 2)}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erreur API Anthropic (${anthropicRes.status})`,
          detail: errBody,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.text ?? "";

    const cleaned = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("analyse-ia-predictive error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erreur interne",
        detail: String(err),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
