import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Analyse d'un rapport de prestataire extérieur (extincteurs, électricité…)
 * déposé dans « Rapports prestataires » : points conformes / non conformes,
 * résultat global et date de renouvellement du contrôle.
 * Résultat dans `analyses_rapports_prestataires` (chef d'équipe, directeurs de parc).
 *
 * Appel : POST { document_id } avec le jeton de l'utilisateur connecté.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const BUCKET = "alba-techniques";
// Limite de requête de l'API (32 Mo) moins la surcharge base64 (+33 %)
const TAILLE_MAX_OCTETS = 22 * 1024 * 1024;
const ROLES_DEPOT = ["chef_maintenance", "directeur_parc"];

const CONSIGNES = `Tu analyses le compte rendu d'un prestataire extérieur intervenu dans un parc de loisirs indoor (trampolines, bowling, laser game, escape game…) en France : vérification d'extincteurs, installation électrique, alarme incendie / SSI, désenfumage, éclairage de sécurité, portes coupe-feu, ascenseur, gaz, CVC, aires de jeux, etc.

Le chef d'équipe maintenance lira ta synthèse pour savoir quoi corriger et quand renouveler le contrôle. Écris en français simple, sans jargon inutile.

À extraire :
- resultat_global : "conforme" si aucune anomalie, "conforme_avec_reserves" si des observations ou réserves mineures, "non_conforme" si au moins une non-conformité à corriger, "indetermine" si le document ne permet pas de conclure.
- resume : 2 à 4 phrases : ce qui a été contrôlé, le constat général, l'urgence éventuelle.
- points_conformes : chaque élément vérifié et jugé bon (regroupe les éléments identiques, ex. « 12 extincteurs vérifiés conformes »).
- points_non_conformes : chaque anomalie, observation ou réserve, avec sa gravité ("bloquante" si danger immédiat ou mise hors service, "majeure" à corriger rapidement, "mineure" sinon) et l'action concrète à mener.
- date_controle : date de l'intervention (AAAA-MM-JJ) si elle figure.
- prochaine_echeance : date du prochain contrôle (AAAA-MM-JJ). Si le document l'indique, reprends-la. Sinon, si la périodicité réglementaire usuelle est claire pour ce type de contrôle (ex. extincteurs : annuelle), calcule-la à partir de date_controle et indique-le dans periodicite. Sinon null.
- periodicite : ex. "annuelle", "semestrielle", "tous les 5 ans", avec « (réglementaire usuelle) » si elle ne figure pas dans le document ; null si inconnue.
- prestataire : nom de la société qui a réalisé le contrôle, si présent.

N'invente rien : si une information n'est pas dans le document, mets null ou une liste vide. Si le document n'est pas un rapport de contrôle ou est illisible, résultat "indetermine" et explique-le dans le résumé.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "resultat_global",
    "resume",
    "points_conformes",
    "points_non_conformes",
    "date_controle",
    "prochaine_echeance",
    "periodicite",
    "prestataire",
  ],
  properties: {
    resultat_global: { type: "string", enum: ["conforme", "conforme_avec_reserves", "non_conforme", "indetermine"] },
    resume: { type: "string" },
    points_conformes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["intitule", "detail"],
        properties: { intitule: { type: "string" }, detail: { type: ["string", "null"] } },
      },
    },
    points_non_conformes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["intitule", "detail", "gravite", "action"],
        properties: {
          intitule: { type: "string" },
          detail: { type: ["string", "null"] },
          gravite: { type: "string", enum: ["bloquante", "majeure", "mineure"] },
          action: { type: ["string", "null"] },
        },
      },
    },
    date_controle: { type: ["string", "null"] },
    prochaine_echeance: { type: ["string", "null"] },
    periodicite: { type: ["string", "null"] },
    prestataire: { type: ["string", "null"] },
  },
};

interface Analyse {
  resultat_global: string;
  resume: string;
  points_conformes: { intitule: string; detail: string | null }[];
  points_non_conformes: { intitule: string; detail: string | null; gravite: string; action: string | null }[];
  date_controle: string | null;
  prochaine_echeance: string | null;
  periodicite: string | null;
  prestataire: string | null;
}

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const dateValide = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) ? d : null);

function enBase64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let documentId: string | null = null;

  try {
    // Appelant : utilisateur connecté autorisé à déposer des rapports
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await service.auth.getUser(jeton);
    if (!auth?.user) return repondre({ success: false, error: "Non authentifié" }, 401);
    const { data: appelant } = await service
      .from("utilisateurs")
      .select("id, roles(code)")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle();
    const role = (appelant?.roles as { code?: string } | null)?.code ?? "";
    if (!ROLES_DEPOT.includes(role)) return repondre({ success: false, error: "Accès refusé" }, 403);

    const corps = await req.json().catch(() => ({}));
    documentId = typeof corps.document_id === "string" ? corps.document_id : null;
    if (!documentId) return repondre({ success: false, error: "document_id requis" }, 400);

    const { data: doc } = await service
      .from("documents_techniques")
      .select("id, type, titre, activite, prestataire, chemin, mime, taille, parties, prochaine_echeance")
      .eq("id", documentId)
      .eq("type", "prestataire")
      .maybeSingle();
    if (!doc) return repondre({ success: false, error: "Rapport prestataire introuvable" }, 404);

    await service
      .from("analyses_rapports_prestataires")
      .upsert({ document_id: documentId, statut: "en_cours", erreur: null }, { onConflict: "document_id" });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    if ((doc.taille ?? 0) > TAILLE_MAX_OCTETS) {
      throw new Error("Document trop lourd pour l'analyse automatique (22 Mo maximum)");
    }

    // Téléchargement (recollage des parties pour les fichiers découpés)
    const chemins = doc.parties
      ? Array.from({ length: doc.parties }, (_, i) => `${doc.chemin}.part${String(i + 1).padStart(3, "0")}`)
      : [doc.chemin];
    const morceaux: Uint8Array[] = [];
    for (const c of chemins) {
      const { data: fichier, error } = await service.storage.from(BUCKET).download(c);
      if (error || !fichier) throw new Error(`Téléchargement impossible : ${error?.message ?? c}`);
      morceaux.push(new Uint8Array(await fichier.arrayBuffer()));
    }
    const octets = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
    let pos = 0;
    for (const m of morceaux) {
      octets.set(m, pos);
      pos += m.length;
    }
    const donnees = enBase64(octets);
    const mime = (doc.mime ?? "application/pdf").toLowerCase();

    let piece: Anthropic.Beta.BetaContentBlockParam;
    if (mime === "application/pdf") {
      piece = { type: "document", source: { type: "base64", media_type: "application/pdf", data: donnees } };
    } else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      piece = {
        type: "image",
        source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: donnees },
      };
    } else {
      throw new Error(`Format non pris en charge pour l'analyse (${mime}) : déposer un PDF, JPEG ou PNG`);
    }

    const contexte = [
      doc.activite ? `Domaine indiqué : ${doc.activite}` : null,
      doc.prestataire ? `Prestataire indiqué : ${doc.prestataire}` : null,
      `Titre : ${doc.titre}`,
    ]
      .filter(Boolean)
      .join("\n");

    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [{ role: "user", content: [piece, { type: "text", text: `${contexte}\n\nAnalyse ce rapport.` }] }],
    });

    if (reponse.stop_reason === "refusal") throw new Error("Analyse refusée par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Analyse incomplète (rapport trop long)");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const analyse = JSON.parse(texte.text) as Analyse;

    const echeance = dateValide(analyse.prochaine_echeance);
    await service
      .from("analyses_rapports_prestataires")
      .update({
        statut: "terminee",
        resultat_global: analyse.resultat_global,
        resume: analyse.resume,
        points_conformes: analyse.points_conformes ?? [],
        points_non_conformes: analyse.points_non_conformes ?? [],
        date_controle: dateValide(analyse.date_controle),
        prochaine_echeance: echeance,
        periodicite: analyse.periodicite,
        prestataire_detecte: analyse.prestataire,
        modele: reponse.model,
        erreur: null,
        analyse_le: new Date().toISOString(),
      })
      .eq("document_id", documentId);

    // Échéance non saisie au dépôt : on reprend celle trouvée dans le rapport
    if (echeance && !doc.prochaine_echeance) {
      await service.from("documents_techniques").update({ prochaine_echeance: echeance }).eq("id", documentId);
    }

    return repondre({ success: true, resultat_global: analyse.resultat_global, prochaine_echeance: echeance });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service d'analyse saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service d'analyse (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("analyser-rapport-prestataire:", err);
    if (documentId) {
      await service
        .from("analyses_rapports_prestataires")
        .update({ statut: "echec", erreur: message })
        .eq("document_id", documentId);
    }
    return repondre({ success: false, error: message }, 200);
  }
});
