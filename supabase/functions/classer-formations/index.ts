import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Rangement automatique des formations du personnel dans des catégories
 * créées au fur et à mesure (Secourisme, Habilitations électriques…).
 * Classe toutes les formations actives encore sans catégorie, en réutilisant
 * en priorité les catégories déjà existantes.
 *
 * Appel : POST {} avec le jeton de l'utilisateur connecté.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const LOT_MAX = 150;

const CONSIGNES = `Tu ranges les formations suivies par le personnel de parcs de loisirs indoor (trampolines, bowling, laser game, escape game, restauration…) dans des catégories.

Pour chaque intitulé de formation fourni, donne sa catégorie :
- Reprends EXACTEMENT une des catégories existantes si l'une convient.
- Sinon crée une catégorie courte de 1 à 4 mots, avec une majuscule initiale, assez large pour regrouper des formations voisines (ex. « Secourisme », « Habilitations électriques », « Sécurité incendie », « Travail en hauteur », « Conduite d'engins », « Hygiène alimentaire », « Surveillance des activités », « Management »).
- Utilise la même catégorie pour des formations de même nature (ex. SST, MAC SST et PSC1 → « Secourisme »).
Réponds pour tous les intitulés, en les recopiant à l'identique.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classement"],
  properties: {
    classement: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["intitule", "categorie"],
        properties: { intitule: { type: "string" }, categorie: { type: "string" } },
      },
    },
  },
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const utilisateur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: autorise } = await utilisateur.rpc("acces_pilotage_parc", { p_parc: null });
    if (autorise !== true) return repondre({ success: false, error: "Accès refusé" }, 403);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: lignes, error } = await service
      .from("formations_personnel")
      .select("intitule, organisme, categorie")
      .eq("actif", true);
    if (error) throw error;

    const existantes = [...new Set((lignes ?? []).map((l) => l.categorie).filter((c): c is string => !!c))].sort();
    const aClasser = [...new Set((lignes ?? []).filter((l) => !l.categorie).map((l) => l.intitule))].slice(0, LOT_MAX);
    if (aClasser.length === 0) return repondre({ success: true, classees: 0 });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [
        {
          role: "user",
          content: `Catégories existantes : ${existantes.length ? existantes.join(" | ") : "aucune"}.\n\nIntitulés à classer :\n${aClasser.map((i) => `- ${i}`).join("\n")}`,
        },
      ],
    });
    if (reponse.stop_reason === "refusal") throw new Error("Classement refusé par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Classement incomplet");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const { classement } = JSON.parse(texte.text) as { classement: { intitule: string; categorie: string }[] };

    // Recale la casse sur une catégorie existante équivalente
    const parMinuscule = new Map(existantes.map((c) => [c.toLowerCase(), c]));
    const attendus = new Set(aClasser);
    let classees = 0;
    for (const { intitule, categorie } of classement) {
      const nom = categorie.trim().slice(0, 60);
      if (!attendus.has(intitule) || !nom) continue;
      const finale = parMinuscule.get(nom.toLowerCase()) ?? nom;
      parMinuscule.set(finale.toLowerCase(), finale);
      const { error: errMaj } = await service
        .from("formations_personnel")
        .update({ categorie: finale })
        .eq("intitule", intitule)
        .eq("actif", true)
        .is("categorie", null);
      if (!errMaj) classees++;
    }
    return repondre({ success: true, classees });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service de classement (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("classer-formations:", err);
    return repondre({ success: false, error: message }, 200);
  }
});
