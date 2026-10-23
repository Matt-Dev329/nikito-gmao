import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Résumé du lundi au chef d'équipe : tickets ouverts et en retard par parc,
 * tickets les plus anciens, pièces attendues, tickets résolus la semaine
 * passée. Appelé par pg_cron (gmao_resume_hebdo_tickets) ; un seul envoi par
 * semaine (resumes_hebdo_tickets).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (t: string | null | undefined) =>
  (t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const OUVERTS = ["ouvert", "assigne", "en_pause", "en_cours"];

function age(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

type Ticket = {
  id: string;
  numero_bt: string;
  titre: string | null;
  statut: string;
  declare_le: string;
  resolu_le: string | null;
  externe: boolean;
  attente_piece: boolean;
  attente_piece_detail: string | null;
  attente_piece_depuis: string | null;
  parc_ticket_code: string | null;
  niveaux_priorite: { code: string; sla_h: number | null } | null;
  attente_commande: { numero: string; statut: string } | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendApiKey) throw new Error("RESEND_API_KEY manquante");
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    // Un seul résumé par semaine (lundi de la semaine en cours)
    const lundi = new Date();
    lundi.setUTCDate(lundi.getUTCDate() - ((lundi.getUTCDay() + 6) % 7));
    const semaine = lundi.toISOString().slice(0, 10);
    const { error: deja } = await service.from("resumes_hebdo_tickets").insert({ semaine });
    if (deja) return repondre({ success: true, deja: true });

    const ilYa7j = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data: ouverts, error }, { data: resolus }, { data: parcs }, { data: chefs }] = await Promise.all([
      service
        .from("incidents")
        .select(
          "id, numero_bt, titre, statut, declare_le, resolu_le, externe, attente_piece, attente_piece_detail, attente_piece_depuis, parc_ticket_code, niveaux_priorite(code, sla_h), attente_commande:commandes!incidents_attente_piece_commande_id_fkey(numero, statut)",
        )
        .eq("est_formation", false)
        .or("validation_manager.is.null,validation_manager.neq.en_attente")
        .in("statut", OUVERTS)
        .order("declare_le", { ascending: true }),
      service
        .from("incidents")
        .select("id, parc_ticket_code")
        .eq("est_formation", false)
        .in("statut", ["resolu", "ferme"])
        .gte("resolu_le", ilYa7j),
      service.from("parcs").select("code, nom").eq("actif", true).neq("code", "ECO").order("code"),
      service.from("utilisateurs").select("email, roles!inner(code)").eq("actif", true).eq("roles.code", "chef_maintenance"),
    ]);
    if (error) throw error;
    const tickets = (ouverts ?? []) as unknown as Ticket[];
    const enRetard = (t: Ticket) => (Date.now() - new Date(t.declare_le).getTime()) / 3_600_000 > (t.niveaux_priorite?.sla_h ?? 24);

    const lignesParc = ((parcs ?? []) as { code: string; nom: string }[])
      .map((p) => {
        const duParc = tickets.filter((t) => t.parc_ticket_code === p.code);
        const retard = duParc.filter(enRetard).length;
        const piece = duParc.filter((t) => t.attente_piece).length;
        const resolusParc = ((resolus ?? []) as { parc_ticket_code: string | null }[]).filter((r) => r.parc_ticket_code === p.code).length;
        return `<tr>
          <td style="padding:6px 8px;color:#ffffff;font-weight:600;">${esc(p.code)}</td>
          <td style="padding:6px 8px;color:#ffffff;text-align:center;">${duParc.length}</td>
          <td style="padding:6px 8px;text-align:center;color:${retard ? "#FF4D6D" : "#8b92b8"};font-weight:${retard ? 700 : 400};">${retard}</td>
          <td style="padding:6px 8px;color:#FFB547;text-align:center;">${piece}</td>
          <td style="padding:6px 8px;color:#4ADE80;text-align:center;">${resolusParc}</td>
        </tr>`;
      })
      .join("");

    const anciens = tickets.slice(0, 10).map((t) => `<tr>
        <td style="padding:5px 8px;color:#5DE5FF;white-space:nowrap;"><a href="${siteUrl}/gmao/operations/${esc(t.numero_bt)}" style="color:#5DE5FF;">${esc(t.numero_bt)}</a></td>
        <td style="padding:5px 8px;color:#ffffff;">${esc(t.parc_ticket_code)}</td>
        <td style="padding:5px 8px;color:#ffffff;">${esc(t.titre)}</td>
        <td style="padding:5px 8px;color:${enRetard(t) ? "#FF4D6D" : "#ffffff"};white-space:nowrap;">${age(t.declare_le)}</td>
      </tr>`).join("");

    const pieces = tickets
      .filter((t) => t.attente_piece)
      .map((t) => `<li style="margin:0 0 6px 0;"><b>${esc(t.parc_ticket_code)}</b> · ${esc(t.numero_bt)} · ${esc(t.titre)}${t.attente_piece_detail ? ` — ${esc(t.attente_piece_detail)}` : ""}${t.attente_commande ? ` <span style="color:#8b92b8;">(commande ${esc(t.attente_commande.numero)} : ${esc(t.attente_commande.statut)})</span>` : ""}${t.attente_piece_depuis ? ` <span style="color:#FFB547;">depuis ${age(t.attente_piece_depuis)}</span>` : ""}</li>`)
      .join("");

    const totalRetard = tickets.filter(enRetard).length;
    const titre = `Résumé maintenance · ${tickets.length} tickets ouverts dont ${totalRetard} en retard`;
    const th = (t: string) => `<th style="padding:6px 8px;color:#8b92b8;font-size:11px;font-weight:400;text-align:center;">${t}</th>`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
  <tr><td align="center" style="padding:0 0 20px 0;"><span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span></td></tr>
  <tr><td style="background-color:#131836;border-radius:14px;padding:20px;">
    <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:4px;">Résumé de la semaine</div>
    <div style="font-size:13px;color:#8b92b8;padding-bottom:14px;">${tickets.length} tickets ouverts · <b style="color:#FF4D6D;">${totalRetard} en retard</b> · ${tickets.filter((t) => t.attente_piece).length} en attente de pièce · ${(resolus ?? []).length} résolus en 7 jours</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
      <tr>${th("Parc")}${th("Ouverts")}${th("En retard")}${th("Pièce attendue")}${th("Résolus 7 j")}</tr>
      ${lignesParc}
    </table>
  </td></tr>
  <tr><td style="height:14px;"></td></tr>
  <tr><td style="background-color:#131836;border-radius:14px;padding:20px;">
    <div style="font-size:15px;color:#ffffff;font-weight:600;padding-bottom:10px;">Les 10 tickets les plus anciens</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">${anciens || '<tr><td style="color:#8b92b8;">Aucun ticket ouvert.</td></tr>'}</table>
  </td></tr>
  <tr><td style="height:14px;"></td></tr>
  <tr><td style="background-color:#131836;border-radius:14px;padding:20px;">
    <div style="font-size:15px;color:#ffffff;font-weight:600;padding-bottom:10px;">Pièces attendues</div>
    ${pieces ? `<ul style="color:#ffffff;font-size:13px;padding-left:18px;margin:0;">${pieces}</ul>` : '<div style="color:#8b92b8;font-size:13px;">Aucun ticket en attente de pièce.</div>'}
    <div style="padding-top:16px;"><a href="${siteUrl}/gmao/operations" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">Ouvrir Opérations</a></div>
  </td></tr>
  <tr><td style="padding:16px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Résumé automatique du lundi, ALBA. Ne pas répondre.</td></tr>
</table></td></tr></table></body></html>`;

    const emails = ((chefs ?? []) as { email: string | null }[]).map((c) => c.email).filter((e): e is string => !!e);
    if (!emails.length) return repondre({ success: true, envoyes: 0 });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "ALBA by Nikito <noreply@nikito.tech>", to: emails, subject: titre, html }),
    });
    if (!r.ok) {
      // Libère la semaine pour un nouvel essai
      await service.from("resumes_hebdo_tickets").delete().eq("semaine", semaine);
      throw new Error(`Resend ${r.status} : ${await r.text()}`);
    }
    return repondre({ success: true, envoyes: emails.length, ouverts: tickets.length, en_retard: totalRetard });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("resume-hebdo-tickets:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
