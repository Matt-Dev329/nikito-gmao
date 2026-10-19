import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Rédige un mail de demande de réparation à partir des analyses de rapports
 * prestataires sélectionnées (points non conformes, gravité, action à mener).
 * Les rapports sont lus avec le jeton de l'appelant : seuls ceux qu'il a le
 * droit de voir peuvent servir.
 *
 * Appel : POST { document_ids: string[], precision?: string }
 * Réponse : { success, objet, corps }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const MAX_RAPPORTS = 20;

const CONSIGNES = `Tu rédiges, pour le chef d'équipe maintenance d'un parc de loisirs indoor en France (groupe Nikito), un mail de demande d'intervention à envoyer à une entreprise chargée des réparations (électricien, société de maintenance…).

On te donne les anomalies relevées par des organismes de contrôle (rapports prestataires déjà analysés). Le mail doit permettre à l'entreprise de chiffrer et planifier les travaux sans avoir à rappeler.

Règles :
- Français professionnel, simple et direct, vouvoiement. Pas de formule ampoulée.
- Commence par « Bonjour, », présente la demande en une ou deux phrases (parc, organisme de contrôle, date du contrôle).
- Liste les travaux à réaliser, regroupés par parc puis par thème, les plus graves en premier. Pour chaque travail : ce qui est à faire, où (emplacement, équipement, repère, n° d'observation s'ils figurent), et l'urgence (« urgent » pour une gravité bloquante ou majeure).
- Plusieurs rapports peuvent porter sur la même visite et répéter les mêmes anomalies : fusionne les doublons, ne liste chaque travail qu'une fois.
- Ne cite pas les points conformes. N'invente aucun détail (emplacement, quantité, référence) absent des données.
- Termine par la demande : devis et proposition de date d'intervention, puis transmission d'une attestation / compte rendu après travaux pour lever les réserves au registre de sécurité. Signe avec le nom et la fonction fournis.
- Texte brut uniquement (pas de Markdown, pas de HTML) : listes avec des tirets, lignes vides entre les blocs.
- Si une consigne complémentaire est fournie, applique-la tant qu'elle reste une consigne de rédaction pour ce mail.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objet", "corps"],
  properties: {
    objet: { type: "string" },
    corps: { type: "string" },
  },
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type PointNonConforme = { intitule: string; detail: string | null; gravite: string; action: string | null };
type Rapport = {
  id: string;
  titre: string;
  activite: string | null;
  prestataire: string | null;
  date_document: string | null;
  parc: { code: string; nom: string } | null;
  analyse:
    | { statut: string; resume: string | null; date_controle: string | null; points_non_conformes: PointNonConforme[] | null }
    | { statut: string; resume: string | null; date_controle: string | null; points_non_conformes: PointNonConforme[] | null }[]
    | null;
  levees: { point_intitule: string; statut: string }[] | null;
};

const ROLES: Record<string, string> = {
  chef_maintenance: "Chef d'équipe maintenance",
  directeur_parc: "Directeur de parc",
  manager_parc: "Manager",
  direction: "Direction",
  admin_it: "Administrateur",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const appelant = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: auth } = await appelant.auth.getUser(jeton);
    if (!auth?.user) return repondre({ success: false, error: "Non authentifié" }, 401);

    const corps = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(corps.document_ids)
      ? [...new Set((corps.document_ids as unknown[]).filter((x): x is string => typeof x === "string"))]
      : [];
    if (ids.length === 0) return repondre({ success: false, error: "Sélectionne au moins un rapport" }, 400);
    if (ids.length > MAX_RAPPORTS) return repondre({ success: false, error: `${MAX_RAPPORTS} rapports maximum` }, 400);
    const precision = typeof corps.precision === "string" ? corps.precision.trim().slice(0, 1000) : "";

    // Lecture avec les droits de l'appelant (RLS)
    const [{ data: docs, error }, { data: moi }] = await Promise.all([
      appelant
        .from("documents_techniques")
        .select("id, titre, activite, prestataire, date_document, parc:parcs(code, nom), analyse:analyses_rapports_prestataires(statut, resume, date_controle, points_non_conformes), levees:levees_defauts_prestataires(point_intitule, statut)")
        .in("id", ids)
        .eq("type", "prestataire"),
      appelant.from("utilisateurs").select("prenom, nom, roles(code)").eq("auth_user_id", auth.user.id).maybeSingle(),
    ]);
    if (error) throw error;
    const rapports = (docs ?? []) as unknown as Rapport[];
    if (rapports.length < ids.length) return repondre({ success: false, error: "Rapport introuvable ou accès refusé" }, 403);

    const analyseDe = (r: Rapport) => (Array.isArray(r.analyse) ? r.analyse[0] ?? null : r.analyse);
    // Défauts déjà levés (attestation déposée) : plus à réparer
    const ouverts = (r: Rapport) => {
      const leves = new Set((r.levees ?? []).filter((l) => l.statut === "levee").map((l) => l.point_intitule.trim()));
      return (analyseDe(r)?.points_non_conformes ?? []).filter((p) => !leves.has(p.intitule.trim()));
    };
    const utiles = rapports.filter((r) => analyseDe(r)?.statut === "terminee" && ouverts(r).length > 0);
    if (utiles.length === 0) {
      return repondre({ success: false, error: "Aucun point à corriger dans les rapports sélectionnés" }, 400);
    }

    const donnees = utiles.map((r) => {
      const a = analyseDe(r)!;
      return {
        parc: r.parc ? `${r.parc.nom} (${r.parc.code})` : "Tous parcs",
        domaine: r.activite,
        organisme_controle: r.prestataire,
        date_controle: a.date_controle ?? r.date_document,
        rapport: r.titre,
        resume: a.resume,
        anomalies: ouverts(r).map((p) => ({
          intitule: p.intitule,
          detail: p.detail,
          gravite: p.gravite,
          action: p.action,
        })),
      };
    });

    const u = moi as { prenom?: string | null; nom?: string | null; roles?: { code?: string } | null } | null;
    const signature = [`${u?.prenom ?? ""} ${u?.nom ?? ""}`.trim() || "Le chef d'équipe maintenance", ROLES[u?.roles?.code ?? ""] ?? "", "Nikito"]
      .filter(Boolean)
      .join("\n");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    const client = new Anthropic({ apiKey });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [
        {
          role: "user",
          content: [
            `<anomalies>\n${JSON.stringify(donnees, null, 2)}\n</anomalies>`,
            `<signature>\n${signature}\n</signature>`,
            precision ? `<consigne_complementaire>\n${precision}\n</consigne_complementaire>` : null,
            "Rédige le mail (objet et corps).",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    if (reponse.stop_reason === "refusal") throw new Error("Rédaction refusée par le modèle");
    if (reponse.stop_reason === "max_tokens") throw new Error("Mail trop long : sélectionne moins de rapports");
    const texte = reponse.content.find((b) => b.type === "text");
    if (!texte || texte.type !== "text") throw new Error("Réponse vide");
    const mail = JSON.parse(texte.text) as { objet: string; corps: string };

    return repondre({ success: true, objet: mail.objet, corps: mail.corps, rapports: utiles.length });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service de rédaction (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("rediger-mail-reparation:", err);
    return repondre({ success: false, error: message }, 200);
  }
});
