import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Lecture d'une facture fournisseur déposée depuis l'onglet Stock :
 * fournisseur, numéro, date, totaux et lignes (référence, désignation,
 * quantité, prix unitaire HT, activité et catégorie proposées).
 * Le chef d'équipe relit ensuite les lignes avant l'intégration
 * (RPC integrer_facture) au catalogue et, s'il le choisit, au stock.
 *
 * Appel : POST { facture_id } avec le jeton de l'utilisateur connecté.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const BUCKET = "alba-factures";
const TAILLE_MAX_OCTETS = 22 * 1024 * 1024;

const CONSIGNES = `Tu lis une facture (ou un bon de livraison) d'un fournisseur de pièces détachées pour des parcs de loisirs indoor (bowling, laser game, trampolines, escape game…).

Extrais fidèlement :
- fournisseur : nom de la société qui facture ;
- numero : numéro de facture ; date_facture : AAAA-MM-JJ ;
- total_ht et total_ttc en euros (nombres) ;
- lignes : uniquement les articles (pas les frais de port, remises globales, éco-participation ou lignes de total). Pour chaque article : reference (référence fournisseur telle qu'imprimée, null si absente), designation (libellé clair en français), quantite, prix_unitaire_ht (prix unitaire HT après remise de ligne, en euros).
- Pour chaque ligne, propose aussi activite parmi la liste fournie (ou null si aucune ne convient) et une categorie courte (ex. « Requilleuse », « Électronique », « Visserie ») si c'est évident, sinon null.

N'invente rien : si une valeur est illisible ou absente, mets null. Les montants sont des nombres (point décimal), sans symbole €.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fournisseur", "numero", "date_facture", "total_ht", "total_ttc", "lignes"],
  properties: {
    fournisseur: { type: ["string", "null"] },
    numero: { type: ["string", "null"] },
    date_facture: { type: ["string", "null"] },
    total_ht: { type: ["number", "null"] },
    total_ttc: { type: ["number", "null"] },
    lignes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reference", "designation", "quantite", "prix_unitaire_ht", "activite", "categorie"],
        properties: {
          reference: { type: ["string", "null"] },
          designation: { type: "string" },
          quantite: { type: ["number", "null"] },
          prix_unitaire_ht: { type: ["number", "null"] },
          activite: { type: ["string", "null"] },
          categorie: { type: ["string", "null"] },
        },
      },
    },
  },
};

interface Extraction {
  fournisseur: string | null;
  numero: string | null;
  date_facture: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  lignes: {
    reference: string | null;
    designation: string;
    quantite: number | null;
    prix_unitaire_ht: number | null;
    activite: string | null;
    categorie: string | null;
  }[];
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
  let factureId: string | null = null;

  try {
    // Appelant autorisé à faire des entrées de stock (même règle que la base)
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const utilisateur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: autorise, error: errDroit } = await utilisateur.rpc("peut_entrer_stock");
    if (errDroit || autorise !== true) return repondre({ success: false, error: "Réservé au chef d'équipe" }, 403);

    const corps = await req.json().catch(() => ({}));
    factureId = typeof corps.facture_id === "string" ? corps.facture_id : null;
    if (!factureId) return repondre({ success: false, error: "facture_id requis" }, 400);

    const { data: facture } = await service
      .from("factures_stock")
      .select("id, fichier, mime, taille")
      .eq("id", factureId)
      .maybeSingle();
    if (!facture) return repondre({ success: false, error: "Facture introuvable" }, 404);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    if ((facture.taille ?? 0) > TAILLE_MAX_OCTETS) throw new Error("Facture trop lourde pour la lecture automatique (22 Mo maximum)");

    const { data: fichier, error: errDl } = await service.storage.from(BUCKET).download(facture.fichier);
    if (errDl || !fichier) throw new Error(`Téléchargement impossible : ${errDl?.message ?? ""}`);
    const donnees = enBase64(new Uint8Array(await fichier.arrayBuffer()));
    const mime = (facture.mime ?? "application/pdf").toLowerCase();

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

    // Activités du catalogue proposées au modèle
    const { data: activites } = await service.from("commande_activites").select("id, nom").eq("actif", true).order("nom");
    const listeActivites = (activites ?? []).map((a: { nom: string }) => a.nom).join(", ");

    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [
        {
          role: "user",
          content: [piece, { type: "text", text: `Activités possibles : ${listeActivites || "aucune"}.\n\nLis cette facture.` }],
        },
      ],
    });

    if (reponse.stop_reason === "refusal") throw new Error("Lecture refusée par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Facture trop longue pour une lecture complète");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const extraction = JSON.parse(texte.text) as Extraction;

    // Fournisseur connu ?
    let fournisseurId: string | null = null;
    if (extraction.fournisseur) {
      const { data: f } = await service
        .from("fournisseurs")
        .select("id")
        .ilike("nom", `%${extraction.fournisseur.replace(/[%_]/g, "").slice(0, 60)}%`)
        .limit(1)
        .maybeSingle();
      fournisseurId = f?.id ?? null;
    }

    await service
      .from("factures_stock")
      .update({
        statut: "a_valider",
        fournisseur_nom: extraction.fournisseur,
        fournisseur_id: fournisseurId,
        numero: extraction.numero,
        date_facture: dateValide(extraction.date_facture),
        total_ht: extraction.total_ht,
        total_ttc: extraction.total_ttc,
        erreur: null,
      })
      .eq("id", factureId);

    const idsActivites = new Map((activites ?? []).map((a: { id: string; nom: string }) => [a.nom.toLowerCase(), a.id]));
    return repondre({
      success: true,
      facture: {
        fournisseur: extraction.fournisseur,
        fournisseur_connu: !!fournisseurId,
        numero: extraction.numero,
        date_facture: dateValide(extraction.date_facture),
        total_ht: extraction.total_ht,
        total_ttc: extraction.total_ttc,
      },
      lignes: extraction.lignes.map((l) => ({
        ...l,
        activite_id: l.activite ? idsActivites.get(l.activite.toLowerCase()) ?? null : null,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service de lecture saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service de lecture (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("extraire-facture:", err);
    if (factureId) await service.from("factures_stock").update({ statut: "echec", erreur: message }).eq("id", factureId);
    return repondre({ success: false, error: message }, 200);
  }
});
