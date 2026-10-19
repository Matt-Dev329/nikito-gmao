import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Lit une attestation / un compte rendu d'intervention déposé pour lever les
 * défauts d'un rapport prestataire, et propose pour chaque défaut encore
 * ouvert s'il est levé (avec la justification lue dans le document).
 * N'enregistre rien : l'utilisateur confirme ensuite (lever_defauts_prestataire).
 *
 * Appel : POST { document_id, chemin, mime } avec le jeton de l'utilisateur.
 * Réponse : { success, resume, points: [{ intitule, levee, justification }] }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const BUCKET = "alba-techniques";
const TAILLE_MAX_OCTETS = 22 * 1024 * 1024;

const CONSIGNES = `Tu aides le chef d'équipe maintenance d'un parc de loisirs indoor (France) à lever les défauts relevés lors d'un contrôle réglementaire (électricité, sécurité incendie, extincteurs…).

On te donne la liste des défauts encore ouverts du rapport de contrôle, et un document fourni après travaux : attestation, compte rendu d'intervention, facture détaillée, bon d'intervention, photo…

Pour chaque défaut de la liste, dis s'il est levé par ce document :
- levee = true seulement si le document indique clairement que ce défaut précis a été corrigé (même équipement / emplacement / nature de travaux). Une correspondance vague ou supposée ne suffit pas.
- justification : une phrase courte qui cite ce que dit le document (travaux réalisés, date, intervenant) ; si non levé, dis pourquoi en quelques mots (« non mentionné », « travaux partiels : 2 blocs sur 3 »…).
- Reprends l'intitulé EXACT de chaque défaut, sans en ajouter ni en retirer.
- resume : 1 à 2 phrases sur le document (type, société, date, travaux).
Si le document n'est pas lisible ou n'a rien à voir, tous les défauts à false et explique-le dans resume.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resume", "points"],
  properties: {
    resume: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["intitule", "levee", "justification"],
        properties: {
          intitule: { type: "string" },
          levee: { type: "boolean" },
          justification: { type: "string" },
        },
      },
    },
  },
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function enBase64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

type PointNonConforme = { intitule: string; detail: string | null; gravite: string; action: string | null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: auth } = await service.auth.getUser(jeton);
    if (!auth?.user) return repondre({ success: false, error: "Non authentifié" }, 401);

    const corps = await req.json().catch(() => ({}));
    const documentId = typeof corps.document_id === "string" ? corps.document_id : null;
    const chemin = typeof corps.chemin === "string" ? corps.chemin : "";
    const mime = (typeof corps.mime === "string" && corps.mime ? corps.mime : "application/pdf").toLowerCase();
    if (!documentId || !chemin.startsWith("prestataire/") || chemin.includes("..")) {
      return repondre({ success: false, error: "Paramètres invalides" }, 400);
    }

    const { data: doc } = await service
      .from("documents_techniques")
      .select("id, parc_id, titre, activite, prestataire")
      .eq("id", documentId)
      .eq("type", "prestataire")
      .maybeSingle();
    if (!doc) return repondre({ success: false, error: "Rapport prestataire introuvable" }, 404);

    const appelant = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: autorise } = await appelant.rpc("acces_pilotage_parc", { p_parc: doc.parc_id });
    if (autorise !== true) return repondre({ success: false, error: "Accès refusé" }, 403);

    const [{ data: analyse }, { data: levees }] = await Promise.all([
      service.from("analyses_rapports_prestataires").select("points_non_conformes").eq("document_id", documentId).maybeSingle(),
      service.from("levees_defauts_prestataires").select("point_intitule").eq("document_id", documentId).eq("statut", "levee"),
    ]);
    const dejaLeves = new Set((levees ?? []).map((l: { point_intitule: string }) => l.point_intitule.trim()));
    const ouverts = ((analyse?.points_non_conformes ?? []) as PointNonConforme[]).filter((p) => !dejaLeves.has(p.intitule.trim()));
    if (ouverts.length === 0) return repondre({ success: false, error: "Tous les défauts de ce rapport sont déjà levés" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");

    const { data: fichier, error: errDl } = await service.storage.from(BUCKET).download(chemin);
    if (errDl || !fichier) throw new Error(`Téléchargement impossible : ${errDl?.message ?? chemin}`);
    const octets = new Uint8Array(await fichier.arrayBuffer());
    if (octets.length > TAILLE_MAX_OCTETS) throw new Error("Document trop lourd pour la lecture automatique (22 Mo maximum)");
    const donnees = enBase64(octets);

    let piece: Anthropic.Beta.BetaContentBlockParam;
    if (mime === "application/pdf") {
      piece = { type: "document", source: { type: "base64", media_type: "application/pdf", data: donnees } };
    } else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      piece = {
        type: "image",
        source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: donnees },
      };
    } else {
      throw new Error(`Format non pris en charge (${mime}) : déposer un PDF, JPEG ou PNG`);
    }

    const contexte = [
      `Rapport de contrôle : ${[doc.activite, doc.prestataire, doc.titre].filter(Boolean).join(" · ")}`,
      `<defauts_ouverts>\n${JSON.stringify(ouverts.map((p) => ({ intitule: p.intitule, detail: p.detail, action: p.action })), null, 2)}\n</defauts_ouverts>`,
      "Indique pour chaque défaut s'il est levé par le document joint.",
    ].join("\n\n");

    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [{ role: "user", content: [piece, { type: "text", text: contexte }] }],
    });

    if (reponse.stop_reason === "refusal") throw new Error("Lecture refusée par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Lecture incomplète (document trop long)");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const resultat = JSON.parse(texte.text) as { resume: string; points: { intitule: string; levee: boolean; justification: string }[] };

    // On ne garde que les défauts réellement ouverts, dans l'ordre du rapport
    const parIntitule = new Map(resultat.points.map((p) => [p.intitule.trim(), p]));
    const points = ouverts.map((p) => {
      const r = parIntitule.get(p.intitule.trim());
      return { intitule: p.intitule, levee: r?.levee === true, justification: r?.justification ?? "Non évalué" };
    });

    return repondre({ success: true, resume: resultat.resume, points });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service de lecture (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("analyser-attestation-levee:", err);
    return repondre({ success: false, error: message }, 200);
  }
});
