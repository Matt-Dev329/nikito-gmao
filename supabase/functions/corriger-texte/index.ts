import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Correction / reformulation d'un texte saisi dans ALBA (signalement,
 * diagnostic, actions, bons d'intervention…). Rien n'est enregistré ici : le
 * texte proposé remplace la saisie dans le champ, l'utilisateur peut annuler.
 *
 * Appel : POST { texte, mode: "corriger" | "reformuler" }.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELE = "claude-opus-5-5";
const LONGUEUR_MAX = 4000;

const CONSIGNES: Record<string, string> = {
  corriger: `Tu corriges un texte écrit en français par le personnel de maintenance de parcs de loisirs (bowling, laser game, karting, trampoline, arcade…), souvent tapé vite sur une tablette ou dicté.

Corrige uniquement l'orthographe, la grammaire, les accords, la ponctuation et les majuscules. Garde les mêmes mots, le même ordre et le même ton : ne reformule pas, n'ajoute rien, ne retire rien. Garde tels quels les codes, références, numéros (BT-…, KART 03, M10x30…), noms propres et termes techniques. Si le texte est déjà correct, renvoie-le à l'identique.`,
  reformuler: `Tu reformules un texte écrit en français par le personnel de maintenance de parcs de loisirs (bowling, laser game, karting, trampoline, arcade…), souvent tapé vite sur une tablette ou dicté.

Réécris-le en phrases claires, correctes et professionnelles, compréhensibles par un technicien ou un directeur de parc. Garde exactement le même sens et toutes les informations (faits, quantités, codes, références, numéros, noms, termes techniques) : n'invente rien, n'ajoute aucune information, aucune hypothèse ni formule de politesse. Reste concis, sans titre ni mise en forme, à peu près la même longueur.`,
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["texte"],
  properties: { texte: { type: "string" } },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return repondre({ success: false, error: "Clé ANTHROPIC_API_KEY non configurée" }, 500);

    const corps = await req.json().catch(() => ({}));
    const texte = typeof corps.texte === "string" ? corps.texte.trim() : "";
    const mode = corps.mode === "reformuler" ? "reformuler" : "corriger";
    if (!texte) return repondre({ success: false, error: "Rien à corriger" }, 400);
    if (texte.length > LONGUEUR_MAX) return repondre({ success: false, error: `Texte trop long (max ${LONGUEUR_MAX} caractères)` }, 400);

    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES[mode],
      messages: [{ role: "user", content: `Texte :\n<texte>\n${texte}\n</texte>` }],
    });

    if (reponse.stop_reason === "refusal") return repondre({ success: false, error: "Correction refusée" }, 422);
    const bloc = reponse.content.find((b) => b.type === "text");
    if (!bloc || bloc.type !== "text") return repondre({ success: false, error: "Réponse vide" }, 502);
    const resultat = (JSON.parse(bloc.text) as { texte?: string }).texte?.trim();
    if (!resultat) return repondre({ success: false, error: "Réponse vide" }, 502);
    return repondre({ success: true, texte: resultat });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("corriger-texte:", message);
    return repondre({ success: false, error: "Correction impossible pour le moment" }, 500);
  }
});
