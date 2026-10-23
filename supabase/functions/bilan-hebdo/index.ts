import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Bilan de la semaine au chef d'équipe (7 derniers jours) : tickets,
 * interventions, contrôles, commandes, stock, prestataires, contrats, équipe.
 * Appelé chaque lundi par pg_cron (gmao_resume_hebdo_tickets) ; un seul envoi
 * par semaine (bilans_hebdo).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (t: string | number | null | undefined) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const OUVERTS = ["ouvert", "assigne", "en_pause", "en_cours"];
const dateFr = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

function age(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} j`;
}

// Mise en page : carte, titre de section, tableau, puces
const carte = (contenu: string) =>
  `<tr><td style="background-color:#131836;border-radius:14px;padding:20px;">${contenu}</td></tr><tr><td style="height:14px;"></td></tr>`;
const titre = (t: string) => `<div style="font-size:15px;color:#ffffff;font-weight:600;padding-bottom:10px;">${t}</div>`;
const vide = (t: string) => `<div style="color:#8b92b8;font-size:13px;">${t}</div>`;
const puces = (items: string[]) =>
  `<ul style="color:#ffffff;font-size:13px;padding-left:18px;margin:0;">${items.map((i) => `<li style="margin:0 0 5px 0;">${i}</li>`).join("")}</ul>`;
const tableau = (entetes: string[], lignes: string[][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
    <tr>${entetes.map((e, i) => `<th style="padding:5px 6px;color:#8b92b8;font-size:11px;font-weight:400;text-align:${i ? "center" : "left"};">${e}</th>`).join("")}</tr>
    ${lignes.map((l) => `<tr>${l.map((c, i) => `<td style="padding:5px 6px;color:#ffffff;text-align:${i ? "center" : "left"};border-top:1px solid #222a52;">${c}</td>`).join("")}</tr>`).join("")}
  </table>`;
const chiffre = (valeur: number | string, libelle: string, couleur = "#ffffff") =>
  `<td style="padding:8px;text-align:center;"><div style="font-size:22px;font-weight:700;color:${couleur};">${valeur}</div><div style="font-size:11px;color:#8b92b8;">${libelle}</div></td>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendApiKey) throw new Error("RESEND_API_KEY manquante");
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    // Un seul bilan par semaine (lundi de la semaine en cours)
    const lundi = new Date();
    lundi.setUTCDate(lundi.getUTCDate() - ((lundi.getUTCDay() + 6) % 7));
    const semaine = lundi.toISOString().slice(0, 10);
    const { error: deja } = await service.from("bilans_hebdo").insert({ semaine });
    if (deja) return repondre({ success: true, deja: true });

    const depuis = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const depuisDate = depuis.slice(0, 10);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const dans90j = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

    const [
      { data: parcs },
      { data: ouverts, error },
      { data: crees },
      { data: resolus },
      { data: interventions },
      { data: bons },
      { data: controles },
      { data: commandes },
      { data: pieces },
      { data: rapports },
      { data: levees },
      { data: demandes },
      { data: contrats },
      { data: arrivees },
      { data: invitations },
      { data: chefs },
      { data: rouverts },
    ] = await Promise.all([
      service.from("parcs").select("id, code, nom").eq("actif", true).neq("code", "ECO").order("code"),
      service
        .from("incidents")
        .select(
          "numero_bt, titre, declare_le, attente_piece, attente_piece_detail, parc_ticket_code, niveaux_priorite(sla_h), attente_commande:commandes!incidents_attente_piece_commande_id_fkey(numero, statut)",
        )
        .eq("est_formation", false)
        .or("validation_manager.is.null,validation_manager.neq.en_attente")
        .in("statut", OUVERTS)
        .order("declare_le", { ascending: true }),
      service.from("incidents").select("parc_ticket_code").eq("est_formation", false).gte("declare_le", depuis),
      service.from("incidents").select("parc_ticket_code").eq("est_formation", false).in("statut", ["resolu", "ferme"]).gte("resolu_le", depuis),
      service.from("interventions").select("debut, fin, technicien_id").eq("est_formation", false).gte("debut", depuis),
      service.from("bons_intervention").select("id").eq("est_formation", false).eq("actif", true).gte("cree_le", depuis),
      service.from("controles").select("parc_id, type, statut").eq("est_formation", false).gte("date_planifiee", depuisDate).lte("date_planifiee", aujourdhui),
      service.from("commandes").select("numero, statut, directe, cree_le, total_estime, parc:parcs(code)").gte("cree_le", depuis).order("cree_le"),
      service.from("pieces_detachees").select("nom, stock_actuel, stock_min, parc:parcs(code)").eq("est_formation", false),
      service.from("documents_techniques").select("titre, prestataire, parc:parcs(code)").eq("type", "prestataire").eq("actif", true).gte("cree_le", depuis),
      service.from("levees_defauts_prestataires").select("id").eq("statut", "levee").gte("leve_le", depuis),
      service.from("demandes_prestataires").select("objet, statut, urgente, parc:parcs(code)").eq("actif", true).in("statut", ["a_envoyer", "envoyee", "planifiee"]),
      service.from("documents_techniques").select("titre, prochaine_echeance, parc:parcs(code)").eq("type", "contrat").eq("actif", true).not("prochaine_echeance", "is", null).lte("prochaine_echeance", dans90j).order("prochaine_echeance"),
      service.from("utilisateurs").select("prenom, nom, roles!inner(code)").eq("actif", true).gte("cree_le", depuis),
      service.from("invitations").select("email").is("utilise_le", null).gt("expire_le", new Date().toISOString()),
      service.from("utilisateurs").select("email, roles!inner(code)").eq("actif", true).eq("roles.code", "chef_maintenance"),
      service.from("incidents").select("meta").eq("est_formation", false).not("meta->reouvertures", "is", null),
    ]);
    if (error) throw error;

    type Ouvert = {
      numero_bt: string; titre: string | null; declare_le: string; attente_piece: boolean; attente_piece_detail: string | null;
      parc_ticket_code: string | null; niveaux_priorite: { sla_h: number | null } | null; attente_commande: { numero: string; statut: string } | null;
    };
    const tickets = (ouverts ?? []) as unknown as Ouvert[];
    const enRetard = (t: Ouvert) => (Date.now() - new Date(t.declare_le).getTime()) / 3_600_000 > (t.niveaux_priorite?.sla_h ?? 24);
    const listeParcs = (parcs ?? []) as { id: string; code: string; nom: string }[];
    const ctrl = (controles ?? []) as { parc_id: string; type: string; statut: string }[];
    const creesL = (crees ?? []) as { parc_ticket_code: string | null }[];
    const resolusL = (resolus ?? []) as { parc_ticket_code: string | null }[];
    const interv = (interventions ?? []) as { debut: string; fin: string | null; technicien_id: string | null }[];
    const heures = interv.reduce((h, i) => h + (i.fin ? (new Date(i.fin).getTime() - new Date(i.debut).getTime()) / 3_600_000 : 0), 0);
    // Tickets rouverts dans la semaine (historique meta.reouvertures)
    const reouverts = ((rouverts ?? []) as { meta: { reouvertures?: { le: string }[] } | null }[]).filter((i) =>
      (i.meta?.reouvertures ?? []).some((x) => x.le >= depuis)
    ).length;
    const cmd = (commandes ?? []) as unknown as { numero: string; statut: string; directe: boolean; total_estime: number | null; parc: { code: string } | null }[];
    const ruptures = ((pieces ?? []) as unknown as { nom: string; stock_actuel: number; stock_min: number; parc: { code: string } | null }[])
      .filter((p) => p.stock_min > 0 && p.stock_actuel < p.stock_min);
    const ctrlQuotidiens = ctrl.filter((c) => c.type === "quotidien");
    const totalRetard = tickets.filter(enRetard).length;

    const parParc = tableau(
      ["Parc", "Créés", "Résolus", "Ouverts", "En retard", "Contrôles du jour"],
      listeParcs.map((p) => {
        const duParc = tickets.filter((t) => t.parc_ticket_code === p.code);
        const retard = duParc.filter(enRetard).length;
        const cq = ctrlQuotidiens.filter((c) => c.parc_id === p.id);
        const faits = cq.filter((c) => c.statut === "valide").length;
        return [
          `<b>${esc(p.code)}</b>`,
          String(creesL.filter((t) => t.parc_ticket_code === p.code).length),
          `<span style="color:#4ADE80;">${resolusL.filter((t) => t.parc_ticket_code === p.code).length}</span>`,
          String(duParc.length),
          `<span style="color:${retard ? "#FF4D6D" : "#8b92b8"};font-weight:${retard ? 700 : 400};">${retard}</span>`,
          cq.length ? `<span style="color:${faits < cq.length ? "#FFB547" : "#4ADE80"};">${faits}/${cq.length}</span>` : "—",
        ];
      }),
    );

    const anciens = tickets.slice(0, 8).map((t) =>
      `<a href="${siteUrl}/gmao/operations/${esc(t.numero_bt)}" style="color:#5DE5FF;">${esc(t.numero_bt)}</a> · <b>${esc(t.parc_ticket_code)}</b> · ${esc(t.titre)} · <span style="color:${enRetard(t) ? "#FF4D6D" : "#ffffff"};">${age(t.declare_le)}</span>`
    );
    const piecesAttendues = tickets.filter((t) => t.attente_piece).map((t) =>
      `<b>${esc(t.parc_ticket_code)}</b> · ${esc(t.numero_bt)} · ${esc(t.titre)}${t.attente_piece_detail ? ` — ${esc(t.attente_piece_detail)}` : ""}${t.attente_commande ? ` <span style="color:#8b92b8;">(commande ${esc(t.attente_commande.numero)} : ${esc(t.attente_commande.statut)})</span>` : ""}`
    );
    const STATUTS: Record<string, string> = { demandee: "à valider", validee: "validée", commandee: "commandée", livree: "livrée", refusee: "refusée", annulee: "annulée" };
    const commandesL = cmd.map((c) =>
      `${esc(c.numero)} · <b>${esc(c.parc?.code)}</b> · ${esc(STATUTS[c.statut] ?? c.statut)}${c.directe ? " · Arcade (directe)" : ""}${c.total_estime ? ` · ${Number(c.total_estime).toFixed(0)} €` : ""}`
    );
    const prestataires = [
      ...((rapports ?? []) as unknown as { titre: string; prestataire: string | null; parc: { code: string } | null }[]).map((r) =>
        `Rapport déposé : <b>${esc(r.parc?.code ?? "Tous")}</b> · ${esc(r.titre)}${r.prestataire ? ` (${esc(r.prestataire)})` : ""}`
      ),
      ...(levees?.length ? [`${levees.length} défaut${levees.length > 1 ? "s" : ""} levé${levees.length > 1 ? "s" : ""} cette semaine`] : []),
      ...((demandes ?? []) as unknown as { objet: string; statut: string; urgente: boolean; parc: { code: string } | null }[]).map((d) =>
        `Demande en cours : <b>${esc(d.parc?.code)}</b> · ${esc(d.objet)} (${esc(d.statut.replace("_", " "))})${d.urgente ? ' <span style="color:#FF4D6D;">urgent</span>' : ""}`
      ),
      ...((contrats ?? []) as unknown as { titre: string; prochaine_echeance: string; parc: { code: string } | null }[]).map((c) =>
        `Contrat qui se termine le ${dateFr(c.prochaine_echeance)} : <b>${esc(c.parc?.code ?? "Tous")}</b> · ${esc(c.titre)}`
      ),
    ];
    const equipe = [
      ...((arrivees ?? []) as unknown as { prenom: string; nom: string }[]).map((u) => `Nouveau compte : ${esc(u.prenom)} ${esc(u.nom)}`),
      ...((invitations ?? []).length ? [`${(invitations ?? []).length} invitation${(invitations ?? []).length > 1 ? "s" : ""} pas encore acceptée${(invitations ?? []).length > 1 ? "s" : ""}`] : []),
    ];

    const periode = `du ${dateFr(depuis)} au ${dateFr(new Date().toISOString())}`;
    const sujet = `Bilan de la semaine ${periode} · ${creesL.length} tickets créés, ${resolusL.length} résolus, ${totalRetard} en retard`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;width:100%;">
  <tr><td align="center" style="padding:0 0 20px 0;"><span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span></td></tr>
  ${carte(`
    <div style="font-size:18px;color:#ffffff;font-weight:600;">Bilan de la semaine</div>
    <div style="font-size:12px;color:#8b92b8;padding-bottom:12px;">${periode}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${chiffre(creesL.length, "tickets créés")}
      ${chiffre(resolusL.length, "résolus", "#4ADE80")}
      ${chiffre(tickets.length, "encore ouverts")}
      ${chiffre(totalRetard, "en retard", totalRetard ? "#FF4D6D" : "#ffffff")}
    </tr><tr>
      ${chiffre(interv.length, "interventions")}
      ${chiffre(`${Math.round(heures)} h`, "de réparation")}
      ${chiffre((bons ?? []).length, "bons d'intervention")}
      ${chiffre(reouverts, "tickets rouverts", reouverts ? "#FFB547" : "#ffffff")}
    </tr></table>`)}
  ${carte(`${titre("Par parc")}${parParc}`)}
  ${carte(`${titre("Tickets les plus anciens")}${anciens.length ? puces(anciens) : vide("Aucun ticket ouvert.")}`)}
  ${carte(`${titre("Pièces attendues")}${piecesAttendues.length ? puces(piecesAttendues) : vide("Aucun ticket en attente de pièce.")}`)}
  ${carte(`${titre(`Commandes de la semaine (${cmd.length})`)}${commandesL.length ? puces(commandesL) : vide("Aucune commande.")}`)}
  ${carte(`${titre(`Stock sous le minimum (${ruptures.length})`)}${ruptures.length ? puces(ruptures.slice(0, 15).map((p) => `<b>${esc(p.parc?.code ?? "Commun")}</b> · ${esc(p.nom)} : ${p.stock_actuel} / ${p.stock_min}`)) : vide("Aucune pièce sous le minimum.")}`)}
  ${carte(`${titre("Prestataires et contrats")}${prestataires.length ? puces(prestataires) : vide("Rien de nouveau cette semaine.")}`)}
  ${equipe.length ? carte(`${titre("Équipe")}${puces(equipe)}`) : ""}
  <tr><td align="center" style="padding:4px 0 0 0;"><a href="${siteUrl}/gmao" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">Ouvrir ALBA</a></td></tr>
  <tr><td style="padding:16px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Bilan automatique envoyé chaque lundi matin par ALBA. Ne pas répondre.</td></tr>
</table></td></tr></table></body></html>`;

    const emails = ((chefs ?? []) as { email: string | null }[]).map((c) => c.email).filter((e): e is string => !!e);
    if (!emails.length) return repondre({ success: true, envoyes: 0 });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "ALBA by Nikito <noreply@nikito.tech>", to: emails, subject: sujet, html }),
    });
    if (!r.ok) {
      // Libère la semaine pour un nouvel essai
      await service.from("bilans_hebdo").delete().eq("semaine", semaine);
      throw new Error(`Resend ${r.status} : ${await r.text()}`);
    }
    return repondre({ success: true, envoyes: emails.length, crees: creesL.length, resolus: resolusL.length, en_retard: totalRetard });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("bilan-hebdo:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
