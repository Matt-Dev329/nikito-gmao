import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Envoie par mail le rapport des analyses prestataires choisies : synthèse,
 * défauts (encore ouverts ou levés) classés par parc puis par rapport, et les
 * PDF des rapports en pièces jointes.
 * Appelé par trg_envoyer_rapport_analyses (POST { envoi_id }). On ne fait
 * confiance qu'à la base : seule une demande « a_envoyer » part, une seule fois.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const dateFr = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");

type Point = { intitule: string; detail?: string; action?: string; gravite?: string };
type Analyse = {
  statut: string;
  resultat_global: string | null;
  resume: string | null;
  date_controle: string | null;
  prochaine_echeance: string | null;
  points_non_conformes: Point[] | null;
};
type Document = {
  id: string;
  titre: string;
  activite: string | null;
  prestataire: string | null;
  chemin: string;
  date_document: string | null;
  prochaine_echeance: string | null;
  parc: { code: string; nom: string } | null;
  analyse: Analyse | Analyse[] | null;
  levees: { point_intitule: string; statut: string; leve_par_nom: string | null; leve_le: string | null }[] | null;
};

const ORDRE: Record<string, number> = { bloquante: 0, majeure: 1, mineure: 2 };
const COULEUR: Record<string, string> = { bloquante: "#FF4D6D", majeure: "#FFB547", mineure: "#8b92b8" };
const LIBELLE: Record<string, string> = { bloquante: "Bloquant", majeure: "Majeur", mineure: "Mineur" };
const RESULTAT: Record<string, string> = {
  conforme: "Conforme",
  conforme_avec_reserves: "Conforme avec réserves",
  non_conforme: "Non conforme",
  indetermine: "Indéterminé",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let envoiId: string | null = null;
  try {
    const corps = await req.json().catch(() => ({}));
    envoiId = typeof corps.envoi_id === "string" ? corps.envoi_id : null;
    if (!envoiId) return repondre({ success: false, error: "envoi_id requis" }, 400);

    // Prise de la demande (une seule fois)
    const { data: envoi } = await service
      .from("envois_rapports_analyses")
      .update({ statut: "en_cours" })
      .eq("id", envoiId)
      .eq("statut", "a_envoyer")
      .select("id, document_ids, destinataire_ids, urgent, message, demande_par_id")
      .maybeSingle();
    if (!envoi) return repondre({ success: true, envoyes: 0, deja: true });

    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendApiKey) throw new Error("RESEND_API_KEY manquante");
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    const [{ data: docs, error: errDocs }, { data: dest }, { data: auteur }] = await Promise.all([
      service
        .from("documents_techniques")
        .select(
          `id, titre, activite, prestataire, chemin, date_document, prochaine_echeance, parc:parcs(code, nom),
          analyse:analyses_rapports_prestataires(statut, resultat_global, resume, date_controle, prochaine_echeance, points_non_conformes),
          levees:levees_defauts_prestataires(point_intitule, statut, leve_par_nom, leve_le)`,
        )
        .in("id", envoi.document_ids)
        .eq("type", "prestataire")
        .eq("actif", true),
      service.from("utilisateurs").select("id, email").in("id", envoi.destinataire_ids).eq("actif", true),
      envoi.demande_par_id
        ? service.from("utilisateurs").select("prenom, nom").eq("id", envoi.demande_par_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (errDocs) throw errDocs;
    const documents = ((docs ?? []) as unknown as Document[]).sort(
      (a, b) => (a.parc?.code ?? "~").localeCompare(b.parc?.code ?? "~") || a.titre.localeCompare(b.titre),
    );
    const emails = [...new Set(((dest ?? []) as { email: string | null }[]).map((u) => u.email?.trim()).filter(Boolean))] as string[];
    if (!documents.length) throw new Error("Aucun rapport trouvé");
    if (!emails.length) throw new Error("Aucun destinataire avec une adresse mail");

    const analyseDe = (d: Document) => (Array.isArray(d.analyse) ? d.analyse[0] ?? null : d.analyse);
    const leveeDe = (d: Document, p: Point) =>
      (d.levees ?? []).find((l) => l.statut === "levee" && l.point_intitule.trim() === p.intitule.trim()) ?? null;

    // Comptes
    let total = 0, ouverts = 0, bloquants = 0;
    const lignesBloquantes: string[] = [];
    for (const d of documents) {
      for (const p of analyseDe(d)?.points_non_conformes ?? []) {
        total++;
        if (leveeDe(d, p)) continue;
        ouverts++;
        if (p.gravite === "bloquante") {
          bloquants++;
          lignesBloquantes.push(`<li style="margin:0 0 6px 0;"><b>${echapper(d.parc?.code ?? "Tous parcs")}</b> · ${echapper(p.intitule)}${p.action ? ` — <i>${echapper(p.action)}</i>` : ""}</li>`);
        }
      }
    }

    // Pièces jointes : liens signés 7 jours, que Resend télécharge
    const liens = new Map<string, string>();
    await Promise.all(
      documents.map(async (d) => {
        const { data } = await service.storage.from("alba-techniques").createSignedUrl(d.chemin, 7 * 86400);
        if (data?.signedUrl) liens.set(d.id, data.signedUrl);
      }),
    );

    const blocs = documents.map((d) => {
      const a = analyseDe(d);
      const points = [...(a?.points_non_conformes ?? [])].sort(
        (x, y) => (ORDRE[x.gravite ?? "mineure"] ?? 3) - (ORDRE[y.gravite ?? "mineure"] ?? 3),
      );
      const echeance = a?.prochaine_echeance ?? d.prochaine_echeance;
      const lignes = points
        .map((p) => {
          const g = p.gravite ?? "mineure";
          const l = leveeDe(d, p);
          return `<tr><td style="padding:8px 0;border-top:1px solid #222a52;vertical-align:top;">
            <span style="display:inline-block;font-size:11px;font-weight:700;color:${COULEUR[g] ?? "#8b92b8"};padding-right:6px;">${LIBELLE[g] ?? g}</span>
            <span style="color:#ffffff;font-size:14px;font-weight:600;${l ? "text-decoration:line-through;opacity:.6;" : ""}">${echapper(p.intitule)}</span>
            ${l ? `<span style="color:#4ADE80;font-size:12px;"> ✓ levé${l.leve_par_nom ? ` par ${echapper(l.leve_par_nom)}` : ""} le ${dateFr(l.leve_le)}</span>` : ""}
            ${p.detail ? `<div style="color:#b8bdd9;font-size:13px;padding-top:3px;">${echapper(p.detail)}</div>` : ""}
            ${p.action && !l ? `<div style="color:#5DE5FF;font-size:13px;padding-top:3px;">→ ${echapper(p.action)}</div>` : ""}
          </td></tr>`;
        })
        .join("");
      const lien = liens.get(d.id);
      return `<tr><td style="background-color:#131836;border-radius:14px;padding:20px;">
        <div style="font-size:12px;color:#5DE5FF;font-weight:700;letter-spacing:1px;">${echapper(d.parc ? `${d.parc.code} · ${d.parc.nom}` : "Tous les parcs")}${d.activite ? ` — ${echapper(d.activite)}` : ""}</div>
        <div style="font-size:16px;color:#ffffff;font-weight:600;padding:4px 0 6px 0;">${echapper(d.titre)}</div>
        <div style="font-size:12px;color:#8b92b8;padding-bottom:10px;">${echapper(d.prestataire ?? "")} · contrôle du ${dateFr(a?.date_controle ?? d.date_document)} · prochain contrôle ${dateFr(echeance)} · <b style="color:${a?.resultat_global === "conforme" ? "#4ADE80" : "#FFB547"};">${echapper(RESULTAT[a?.resultat_global ?? ""] ?? "Non analysé")}</b></div>
        ${a?.resume ? `<div style="font-size:13px;color:#d6d9ec;line-height:1.5;padding-bottom:10px;">${echapper(a.resume)}</div>` : ""}
        ${points.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lignes}</table>` : `<div style="color:#4ADE80;font-size:13px;">Aucun défaut relevé.</div>`}
        ${lien ? `<div style="padding-top:12px;"><a href="${lien}" style="color:#5DE5FF;font-size:13px;">📄 Ouvrir le rapport PDF</a> <span style="color:#8b92b8;font-size:11px;">(lien valable 7 jours, PDF aussi en pièce jointe)</span></div>` : ""}
      </td></tr><tr><td style="height:14px;"></td></tr>`;
    }).join("");

    const parcs = [...new Set(documents.map((d) => d.parc?.code ?? "Tous parcs"))].join(" & ");
    const prestataires = [...new Set(documents.map((d) => d.prestataire).filter(Boolean))].join(", ");
    const objet = `${envoi.urgent ? "[URGENT] " : ""}Rapport ${prestataires || "prestataires"} · ${parcs} · ${ouverts} défaut${ouverts > 1 ? "s" : ""} à traiter${bloquants ? ` dont ${bloquants} bloquant${bloquants > 1 ? "s" : ""}` : ""}`;
    const nomAuteur = auteur ? `${(auteur as { prenom: string }).prenom} ${(auteur as { nom: string }).nom}`.trim() : "ALBA";

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
      <tr><td align="center" style="padding:0 0 20px 0;">
        <span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span>
      </td></tr>
      ${envoi.urgent ? `<tr><td style="background-color:#FF4D6D;border-radius:12px;padding:12px 16px;color:#ffffff;font-size:15px;font-weight:700;text-align:center;">⚠️ URGENT — à traiter en priorité</td></tr><tr><td style="height:14px;"></td></tr>` : ""}
      <tr><td style="background-color:#131836;border-radius:14px;padding:20px;border-left:4px solid ${bloquants ? "#FF4D6D" : "#FFB547"};">
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:8px;">Rapport des contrôles ${echapper(prestataires)} — ${echapper(parcs)}</div>
        <div style="font-size:14px;color:#d6d9ec;line-height:1.6;">
          ${documents.length} rapport${documents.length > 1 ? "s" : ""} · <b>${total}</b> défaut${total > 1 ? "s" : ""} relevé${total > 1 ? "s" : ""} · <b style="color:#FFB547;">${ouverts}</b> encore à traiter${bloquants ? ` · <b style="color:#FF4D6D;">${bloquants} bloquant${bloquants > 1 ? "s" : ""}</b>` : ""}
        </div>
        ${envoi.message ? `<div style="font-size:14px;color:#ffffff;padding-top:12px;white-space:pre-wrap;">${echapper(envoi.message)}</div>` : ""}
        ${lignesBloquantes.length ? `<div style="font-size:13px;color:#FF4D6D;font-weight:700;padding-top:14px;">À traiter immédiatement</div><ul style="color:#ffffff;font-size:13px;padding-left:18px;margin:6px 0 0 0;">${lignesBloquantes.join("")}</ul>` : ""}
        <div style="padding-top:16px;"><a href="${siteUrl}/gmao/analyses-prestataires" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">Voir dans ALBA</a></div>
      </td></tr>
      <tr><td style="height:14px;"></td></tr>
      ${blocs}
      <tr><td style="padding:8px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Envoyé depuis ALBA par ${echapper(nomAuteur)}. Message automatique, ne pas répondre.</td></tr>
    </table>
  </td></tr>
</table></body></html>`;

    const attachments = documents
      .filter((d) => liens.has(d.id))
      .map((d) => ({ filename: `${d.titre.replace(/[\\/:*?"<>|]/g, "_")}.pdf`, path: liens.get(d.id)! }));

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: emails,
        subject: objet,
        html,
        attachments,
        ...(envoi.urgent ? { headers: { "X-Priority": "1", Importance: "high" } } : {}),
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status} : ${await r.text()}`);

    await service.from("envois_rapports_analyses").update({ statut: "envoye", envoye_le: new Date().toISOString(), erreur: null }).eq("id", envoiId);
    return repondre({ success: true, envoyes: emails.length, defauts: total, ouverts, bloquants });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("envoyer-rapport-analyses:", message);
    if (envoiId) await service.from("envois_rapports_analyses").update({ statut: "erreur", erreur: message.slice(0, 1000) }).eq("id", envoiId);
    return repondre({ success: false, error: message }, 500);
  }
});
