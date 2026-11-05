import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

/**
 * Analyse anti-doublon de chaque nouveau ticket (appelée par la base à la
 * création, trigger fn_analyser_doublon_ticket) :
 * - compare le ticket aux tickets encore en cours du même parc, sur le même
 *   équipement ou le même type d'attraction, créés avant lui ;
 * - si c'est le même problème (avis de Claude), le ticket est refusé
 *   automatiquement : « doublon de BT-xxx (ticket déjà en cours) ». Le
 *   déclarant est prévenu et sa remarque est ajoutée en note sur le ticket
 *   d'origine (rien n'est perdu).
 * POST { incident_id, dry_run? } — dry_run : analyse sans rien modifier.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELE = "claude-opus-5-5";
const STATUTS_EN_COURS = ["ouvert", "assigne", "en_cours", "en_pause"];

const CONSIGNES = `Tu es l'assistant maintenance des parcs de loisirs Nikito (GMAO ALBA).
On te donne un NOUVEAU ticket de panne et des tickets DÉJÀ EN COURS du même parc.
Dis si le nouveau ticket est un doublon d'un ticket en cours : même équipement (ou, sans
équipement précis, même endroit / même attraction) ET même problème, décrit avec d'autres mots.
Ce n'est PAS un doublon si l'équipement est différent (ex. trampoline T3 vs T7, kart 05 vs kart 12),
si le problème est différent (ex. mousse usée vs filet déchiré), ou si le nouveau ticket apporte
une panne nouvelle sur le même équipement. En cas de doute, réponds non : un doublon refusé à tort
fait perdre une vraie panne. Réponds en français, raison en une phrase courte.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["doublon", "numero_bt_original", "raison"],
  properties: {
    doublon: { type: "boolean" },
    numero_bt_original: { type: ["string", "null"] },
    raison: { type: "string" },
  },
};

interface Ticket {
  id: string;
  numero_bt: string;
  titre: string | null;
  description: string | null;
  symptome: string | null;
  statut: string;
  equipement_id: string | null;
  declare_le: string;
  declare_par_id: string | null;
  declare_par_nom: string | null;
  validation_manager: string | null;
  est_formation: boolean | null;
  est_brouillon: boolean | null;
  parc_ticket: string | null;
  meta: Record<string, unknown> | null;
  equipements: {
    code: string | null;
    libelle: string | null;
    categorie_id: string | null;
    zones: { nom: string } | null;
    categories_equipement: { nom: string | null; activite: string | null } | null;
  } | null;
}

const SELECT = `id, numero_bt, titre, description, symptome, statut, equipement_id, declare_le, declare_par_id,
  declare_par_nom, validation_manager, est_formation, est_brouillon, parc_ticket, meta,
  equipements(code, libelle, categorie_id, zones(nom), categories_equipement(nom, activite))`;

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const categorieDe = (t: Ticket) => t.equipements?.categorie_id ?? ((t.meta?.categorie_id as string | undefined) ?? null);

function decrire(t: Ticket): string {
  const e = t.equipements;
  return [
    `${t.numero_bt} (déclaré le ${new Date(t.declare_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}${t.declare_par_nom ? ` par ${t.declare_par_nom}` : ""}, statut ${t.statut})`,
    e ? `Équipement : ${[e.code, e.libelle].filter(Boolean).join(" · ")}` : "Équipement : aucun précisé",
    e?.categories_equipement ? `Type : ${[e.categories_equipement.activite, e.categories_equipement.nom].filter(Boolean).join(" · ")}` : null,
    e?.zones?.nom ? `Zone : ${e.zones.nom}` : null,
    t.titre ? `Titre : ${t.titre}` : null,
    t.symptome ? `Symptôme : ${t.symptome}` : null,
    t.description ? `Description : ${t.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function noter(db: SupabaseClient, t: Ticket, analyse: Record<string, unknown>) {
  await db
    .from("incidents")
    .update({ meta: { ...(t.meta ?? {}), doublon_analyse: { le: new Date().toISOString(), ...analyse } } })
    .eq("id", t.id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { incident_id, dry_run } = (await req.json().catch(() => ({}))) as { incident_id?: string; dry_run?: boolean };
    if (!incident_id) return repondre({ success: false, error: "incident_id manquant" }, 400);

    const { data: t, error } = await db.from("incidents").select(SELECT).eq("id", incident_id).maybeSingle<Ticket>();
    if (error) throw error;
    if (!t) return repondre({ success: false, error: "Ticket introuvable" }, 404);
    // Rien à analyser : formation, brouillon, ticket déjà fermé ou refusé, déjà analysé
    if (
      t.est_formation || t.est_brouillon || !STATUTS_EN_COURS.includes(t.statut) ||
      t.validation_manager === "refuse" || (!dry_run && t.meta?.doublon_analyse) || !t.parc_ticket
    ) {
      return repondre({ success: true, analyse: false });
    }

    // Tickets en cours du même parc, créés avant celui-ci, même équipement ou même type
    const { data: autres, error: errAutres } = await db
      .from("incidents")
      .select(SELECT)
      .eq("parc_ticket", t.parc_ticket)
      .in("statut", STATUTS_EN_COURS)
      .eq("est_formation", false)
      .neq("id", t.id)
      .lt("declare_le", t.declare_le)
      .order("declare_le", { ascending: false })
      .limit(200);
    if (errAutres) throw errAutres;
    const cat = categorieDe(t);
    const candidats = ((autres ?? []) as unknown as Ticket[])
      .filter((a) => !a.est_brouillon && a.validation_manager !== "refuse")
      .filter((a) => (t.equipement_id ? a.equipement_id === t.equipement_id : !!cat && categorieDe(a) === cat))
      .slice(0, 15);
    if (!candidats.length) {
      if (!dry_run) await noter(db, t, { doublon: false, raison: "Aucun ticket en cours comparable" });
      return repondre({ success: true, doublon: false, candidats: 0 });
    }

    const cle = Deno.env.get("ANTHROPIC_API_KEY");
    if (!cle) throw new Error("Clé ANTHROPIC_API_KEY non configurée");
    const client = new Anthropic({ apiKey: cle });
    const reponse = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: CONSIGNES,
      messages: [
        {
          role: "user",
          content: `NOUVEAU TICKET\n${decrire(t)}\n\nTICKETS DÉJÀ EN COURS\n${candidats.map(decrire).join("\n\n")}`,
        },
      ],
    });
    if (reponse.stop_reason === "refusal" || reponse.stop_reason === "max_tokens") throw new Error(`Analyse interrompue (${reponse.stop_reason})`);
    const bloc = reponse.content.find((b) => b.type === "text");
    if (!bloc || bloc.type !== "text") throw new Error("Réponse vide");
    const avis = JSON.parse(bloc.text) as { doublon: boolean; numero_bt_original: string | null; raison: string };
    const original = avis.doublon ? candidats.find((c) => c.numero_bt === avis.numero_bt_original) : undefined;

    if (dry_run) return repondre({ success: true, doublon: !!original, original: original?.numero_bt ?? null, raison: avis.raison });
    if (!original) {
      await noter(db, t, { doublon: false, raison: avis.raison, modele: reponse.model });
      return repondre({ success: true, doublon: false, raison: avis.raison });
    }

    // Doublon : refus automatique, le déclarant est prévenu, sa remarque rejoint le ticket d'origine
    const motif = `Refusé automatiquement : doublon de ${original.numero_bt} (ticket déjà en cours). ${avis.raison}`;
    const { error: errRefus } = await db
      .from("incidents")
      .update({
        statut: "annule",
        validation_manager: "refuse",
        supprime_motif: motif.slice(0, 1000),
        supprime_le: new Date().toISOString(),
        meta: {
          ...(t.meta ?? {}),
          doublon_de: original.numero_bt,
          doublon_analyse: { le: new Date().toISOString(), doublon: true, original: original.numero_bt, raison: avis.raison, modele: reponse.model },
        },
      })
      .eq("id", t.id)
      .in("statut", STATUTS_EN_COURS);
    if (errRefus) throw errRefus;

    if (t.declare_par_id) {
      const detail = [t.titre, t.description].filter(Boolean).join(" — ");
      await db.from("notes_partagees").insert({
        objet_type: "ticket",
        objet_id: original.id,
        auteur_id: t.declare_par_id,
        texte: `Signalé une 2e fois (${t.numero_bt}, refusé automatiquement comme doublon)${detail ? ` : ${detail}` : ""}`.slice(0, 4000),
      });
      await db.rpc("notifier_push", {
        p_utilisateur_id: t.declare_par_id,
        p_titre: `Ticket refusé · ${t.numero_bt}`,
        p_corps: `Doublon : ${original.numero_bt} est déjà en cours pour ce problème. Ta remarque y a été ajoutée.`,
        p_url: `/gmao/operations/${original.numero_bt}`,
      });
    }
    return repondre({ success: true, doublon: true, original: original.numero_bt, raison: avis.raison });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("analyser-doublon-ticket:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
