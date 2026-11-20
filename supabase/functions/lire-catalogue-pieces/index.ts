import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Catalogue karting : lecture d'une capture (ou d'un PDF) d'une page du
 * catalogue pièces (vue éclatée Sodi RSX2 V2) : nom de l'ensemble et tableau
 * des pièces (repère, référence, désignation, quantité, prix). Le résultat
 * est relu par l'utilisateur avant l'enregistrement (rien n'est écrit ici).
 *
 * Appel : POST { chemin, mime } (fichier déjà déposé dans alba-catalogue)
 * avec le jeton de l'utilisateur connecté (chef d'équipe, direction, admin IT
 * ou technicien Karting).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const BUCKET = "alba-catalogue";
const TAILLE_MAX_OCTETS = 22 * 1024 * 1024;

const CONSIGNES = `Tu lis une page d'un catalogue de pièces détachées de kart (constructeur Sodikart, modèle RSX2 V2) : en général une vue éclatée numérotée et/ou un tableau de pièces.

Extrais fidèlement :
- ensemble : le nom de l'ensemble ou du sous-ensemble affiché (ex. « Freinage », « Direction », « Châssis », « Carrosserie avant »), en français, null si absent ;
- pieces : chaque pièce listée, dans l'ordre du tableau. Pour chacune : repere (numéro de la vue éclatée, en texte, null si absent), reference (référence constructeur telle qu'imprimée, obligatoire : ignore une ligne sans référence), designation (libellé en français, tel qu'affiché), quantite (nombre par kart si indiqué, sinon null), prix_ht (prix unitaire HT en euros si affiché, sinon null).

N'invente rien : si une valeur est illisible ou absente, mets null. Ne lis que les pièces, pas les menus, boutons ou mentions du site. Les prix sont des nombres (point décimal), sans symbole €.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ensemble", "pieces"],
  properties: {
    ensemble: { type: ["string", "null"] },
    pieces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["repere", "reference", "designation", "quantite", "prix_ht"],
        properties: {
          repere: { type: ["string", "null"] },
          reference: { type: "string" },
          designation: { type: "string" },
          quantite: { type: ["number", "null"] },
          prix_ht: { type: ["number", "null"] },
        },
      },
    },
  },
};

interface Extraction {
  ensemble: string | null;
  pieces: { repere: string | null; reference: string; designation: string; quantite: number | null; prix_ht: number | null }[];
}

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function enBase64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    // Appelant autorisé au catalogue karting (même règle que la base)
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const utilisateur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: autorise, error: errDroit } = await utilisateur.rpc("acces_catalogue_karting");
    if (errDroit || autorise !== true) return repondre({ success: false, error: "Accès refusé" }, 403);

    const corps = await req.json().catch(() => ({}));
    const chemin = typeof corps.chemin === "string" ? corps.chemin : "";
    if (!chemin || chemin.includes("..")) return repondre({ success: false, error: "chemin requis" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");

    // Téléchargement avec les droits de l'utilisateur (bucket réservé au catalogue)
    const { data: fichier, error: errDl } = await utilisateur.storage.from(BUCKET).download(chemin);
    if (errDl || !fichier) throw new Error(`Fichier introuvable : ${errDl?.message ?? ""}`);
    if (fichier.size > TAILLE_MAX_OCTETS) throw new Error("Fichier trop lourd pour la lecture (22 Mo maximum)");
    const mime = (typeof corps.mime === "string" && corps.mime ? corps.mime : fichier.type || "image/png").toLowerCase();
    const donnees = enBase64(new Uint8Array(await fichier.arrayBuffer()));

    let piece: Anthropic.Beta.BetaContentBlockParam;
    if (mime === "application/pdf") {
      piece = { type: "document", source: { type: "base64", media_type: "application/pdf", data: donnees } };
    } else if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      piece = {
        type: "image",
        source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: donnees },
      };
    } else {
      throw new Error(`Format non pris en charge (${mime}) : déposer une capture (PNG, JPEG) ou un PDF`);
    }

    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [{ role: "user", content: [piece, { type: "text", text: "Lis cette page du catalogue pièces." }] }],
    });

    if (reponse.stop_reason === "refusal") throw new Error("Lecture refusée par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Page trop longue : découpe-la en plusieurs captures");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const extraction = JSON.parse(texte.text) as Extraction;

    const pieces = (extraction.pieces ?? [])
      .map((p) => ({
        repere: p.repere?.trim() || null,
        reference: (p.reference ?? "").trim(),
        designation: (p.designation ?? "").trim(),
        quantite: typeof p.quantite === "number" ? p.quantite : null,
        prix_ht: typeof p.prix_ht === "number" ? p.prix_ht : null,
      }))
      .filter((p) => p.reference && p.designation);

    return repondre({ success: true, ensemble: extraction.ensemble?.trim() || null, pieces });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("lire-catalogue-pieces:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
