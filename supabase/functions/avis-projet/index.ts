import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Onglet « Projets » de l'espace personnel (réservé à Ryad, cf
 * acces_tableau_de_bord) :
 * - POST { projet_id, question? } : avis franc sur le projet (intérêt,
 *   faisabilité, étapes, budget, risques…), rangé dans projets_perso.avis ;
 * - POST { mode: "idees" } : propose 3 projets tirés de l'activité de la GMAO
 *   (pannes, équipements qui reviennent), ajoutés à la liste avec leur avis.
 *
 * Tout passe par le jeton de l'utilisateur : la base (RLS) ne laisse lire et
 * écrire que ses propres projets.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";

const CONSIGNES = `Tu es le conseiller de Ryad, chef d'équipe maintenance de Nikito : 4 parcs de loisirs indoor en France (trampolines, bowling, laser game, arcades, escape game, jeux pour enfants…). Il gère une équipe de techniciens, les prestataires, le stock et l'application de maintenance ALBA.

Il te soumet ses idées et projets (techniques, organisation, outils, achats, sécurité, confort client…) ou te demande d'en proposer. Donne un avis franc et concret, comme un collègue expérimenté : dis clairement si c'est une bonne idée et si c'est réalisable, sans flatterie. Si le projet est flou, dis ce qu'il manque. Tiens compte de la réalité d'un parc ouvert au public : sécurité des clients, normes (EN 13219 trampolines, ERP), coupures d'exploitation, budget limité, petite équipe.

Écris en français simple, phrases courtes, pas de jargon inutile. Les montants et délais sont des ordres de grandeur prudents ; s'ils dépendent de devis, dis-le.

Champs de l'avis :
- verdict : une phrase courte qui tranche (ex. « Bonne idée, à lancer avant l'été », « Intéressant mais trop cher en l'état »).
- interet : 1 (peu utile) à 5 (prioritaire).
- faisabilite : realisable, sous_conditions, difficile ou non_realisable.
- resume : 2 à 4 phrases qui expliquent ton avis.
- points_forts : ce que le projet apporte.
- risques : ce qui peut coincer (sécurité, coût, temps, adhésion de l'équipe, fournisseurs…).
- etapes : 3 à 7 étapes concrètes pour le mener, dans l'ordre.
- budget_estime, delai_estime : ordre de grandeur, ou null si impossible à estimer.
- ressources : qui et quoi il faut (techniciens, prestataire, matériel, validation direction…).
- questions : les points à clarifier avant de se lancer.
- ameliorations : tes propositions pour rendre le projet meilleur, moins cher ou plus simple.
- reponse_question : ta réponse à la question posée par Ryad, ou null s'il n'en a pas posé.`;

const texteOuNull = { type: ["string", "null"] };
const listeTextes = { type: "array", items: { type: "string" } };

const SCHEMA_AVIS = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict", "interet", "faisabilite", "resume", "points_forts", "risques", "etapes", "budget_estime",
    "delai_estime", "ressources", "questions", "ameliorations", "reponse_question",
  ],
  properties: {
    verdict: { type: "string" },
    interet: { type: "integer", enum: [1, 2, 3, 4, 5] },
    faisabilite: { type: "string", enum: ["realisable", "sous_conditions", "difficile", "non_realisable"] },
    resume: { type: "string" },
    points_forts: listeTextes,
    risques: listeTextes,
    etapes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titre", "detail"],
        properties: { titre: { type: "string" }, detail: texteOuNull },
      },
    },
    budget_estime: texteOuNull,
    delai_estime: texteOuNull,
    ressources: listeTextes,
    questions: listeTextes,
    ameliorations: listeTextes,
    reponse_question: texteOuNull,
  },
};

const SCHEMA_IDEES = {
  type: "object",
  additionalProperties: false,
  required: ["idees"],
  properties: {
    idees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titre", "description", "avis"],
        properties: { titre: { type: "string" }, description: { type: "string" }, avis: SCHEMA_AVIS },
      },
    },
  },
};

interface Idee {
  titre: string;
  description: string;
  avis: Record<string, unknown>;
}

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface TicketContexte {
  titre: string | null;
  statut: string;
  equipement: { libelle: string | null; parc: { code: string } | null; categorie: { nom: string } | null } | null;
}

/** Ce qui se passe dans les parcs : de quoi ancrer l'avis et les propositions dans la réalité. */
async function contexteGmao(db: SupabaseClient): Promise<string> {
  const depuis = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [{ data: parcs }, { data: tickets }] = await Promise.all([
    db.from("parcs").select("code, nom, ville, surface_m2").eq("actif", true).order("code"),
    db
      .from("incidents")
      .select("titre, statut, equipement:equipements(libelle, parc:parcs(code), categorie:categories_equipement(nom))")
      .gte("declare_le", depuis)
      .eq("est_formation", false)
      .neq("statut", "annule")
      .limit(3000),
  ]);

  const compter = (cles: string[]) => {
    const m = new Map<string, number>();
    cles.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const liste = (tickets ?? []) as unknown as TicketContexte[];
  const ouverts = liste.filter((t) => !["resolu", "ferme"].includes(t.statut)).length;
  const parParc = compter(liste.map((t) => t.equipement?.parc?.code ?? "sans équipement"));
  const parCategorie = compter(liste.map((t) => t.equipement?.categorie?.nom ?? "autre")).slice(0, 10);
  const parEquipement = compter(
    liste.filter((t) => t.equipement?.libelle).map((t) => `${t.equipement!.libelle} (${t.equipement!.parc?.code ?? "?"})`)
  )
    .filter(([, n]) => n >= 2)
    .slice(0, 12);

  return [
    `Parcs : ${(parcs ?? []).map((p) => `${p.code} ${p.nom}${p.ville ? ` (${p.ville})` : ""}${p.surface_m2 ? `, ${p.surface_m2} m²` : ""}`).join(" ; ")}`,
    `Tickets de panne sur 90 jours : ${liste.length} (dont ${ouverts} encore ouverts)`,
    `Par parc : ${parParc.map(([k, n]) => `${k} ${n}`).join(", ")}`,
    `Par type d'équipement : ${parCategorie.map(([k, n]) => `${k} ${n}`).join(", ")}`,
    parEquipement.length ? `Équipements qui reviennent le plus : ${parEquipement.map(([k, n]) => `${k} ×${n}`).join(", ")}` : null,
    `Date du jour : ${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function demander(client: Anthropic, schema: Record<string, unknown>, texte: string) {
  const reponse = await client.beta.messages.create({
    model: MODELE,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: CONSIGNES,
    messages: [{ role: "user", content: texte }],
  });
  if (reponse.stop_reason === "refusal") throw new Error("Demande refusée par le modèle");
  if (reponse.stop_reason === "max_tokens") throw new Error("Réponse incomplète, réessaie");
  const bloc = reponse.content.find((b) => b.type === "text");
  if (!bloc || bloc.type !== "text") throw new Error("Réponse vide");
  return { donnees: JSON.parse(bloc.text), modele: reponse.model };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
  let projetId: string | null = null;

  try {
    const { data: auth } = await db.auth.getUser(jeton);
    if (!auth?.user) return repondre({ success: false, error: "Non authentifié" }, 401);
    const { data: autorise } = await db.rpc("acces_tableau_de_bord");
    if (autorise !== true) return repondre({ success: false, error: "Accès refusé" }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    const client = new Anthropic({ apiKey });
    const corps = await req.json().catch(() => ({}));

    if (corps.mode === "idees") {
      const [contexte, { data: existants }] = await Promise.all([
        contexteGmao(db),
        db.from("projets_perso").select("titre, statut").eq("actif", true),
      ]);
      const deja = (existants ?? []).map((p) => `- ${p.titre} (${p.statut})`).join("\n") || "aucun";
      const { donnees, modele } = await demander(
        client,
        SCHEMA_IDEES,
        `${contexte}\n\nProjets déjà dans sa liste :\n${deja}\n\nPropose-lui 3 projets nouveaux (différents de sa liste), concrets et utiles pour la maintenance des parcs, en t'appuyant sur les chiffres ci-dessus quand c'est pertinent. Pour chacun : un titre court, une description de 2 à 4 phrases (quoi, pourquoi, pour quel gain), et ton avis complet (reponse_question = null).`
      );
      const idees = ((donnees as { idees: Idee[] }).idees ?? []).slice(0, 5);
      const maintenant = new Date().toISOString();
      if (idees.length) {
        const { error } = await db.from("projets_perso").insert(
          idees.map((i) => ({
            titre: i.titre.slice(0, 160),
            description: i.description,
            origine: "alba",
            avis: i.avis,
            avis_statut: "terminee",
            avis_le: maintenant,
            modele,
          }))
        );
        if (error) throw new Error(error.message);
      }
      return repondre({ success: true, nombre: idees.length });
    }

    projetId = typeof corps.projet_id === "string" ? corps.projet_id : null;
    if (!projetId) return repondre({ success: false, error: "projet_id requis" }, 400);
    const question = typeof corps.question === "string" ? corps.question.trim().slice(0, 2000) : "";

    const { data: projet } = await db
      .from("projets_perso")
      .select("id, titre, description, notes, statut, avis")
      .eq("id", projetId)
      .maybeSingle();
    if (!projet) return repondre({ success: false, error: "Projet introuvable" }, 404);

    await db.from("projets_perso").update({ avis_statut: "en_cours", avis_erreur: null }).eq("id", projetId);

    const contexte = await contexteGmao(db);
    const statuts: Record<string, string> = { idee: "simple idée", en_cours: "en cours", termine: "terminé", abandonne: "abandonné" };
    const precedent = projet.avis as { verdict?: string; resume?: string } | null;
    const texte = [
      contexte,
      "",
      `Projet : ${projet.titre}`,
      `Où il en est : ${statuts[projet.statut] ?? projet.statut}`,
      projet.description ? `Description :\n${projet.description}` : "Pas de description.",
      projet.notes ? `Ses notes :\n${projet.notes}` : null,
      precedent?.verdict ? `Ton avis précédent : ${precedent.verdict} — ${precedent.resume ?? ""}` : null,
      question ? `Sa question : ${question}` : null,
      "",
      "Donne ton avis sur ce projet.",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const { donnees, modele } = await demander(client, SCHEMA_AVIS, texte);
    const avis = { ...(donnees as Record<string, unknown>), question: question || null };
    const { error } = await db
      .from("projets_perso")
      .update({ avis, avis_statut: "terminee", avis_erreur: null, avis_le: new Date().toISOString(), modele })
      .eq("id", projetId);
    if (error) throw new Error(error.message);

    return repondre({ success: true });
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Service saturé, réessaie dans quelques minutes"
        : err instanceof Anthropic.APIError
          ? `Erreur du service d'analyse (${err.status ?? "?"})`
          : err instanceof Error
            ? err.message
            : String(err);
    console.error("avis-projet:", err);
    if (projetId) {
      await db.from("projets_perso").update({ avis_statut: "echec", avis_erreur: message }).eq("id", projetId);
    }
    return repondre({ success: false, error: message }, 200);
  }
});
