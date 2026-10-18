import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Ticket résolu : notification dans l'appli + mail au chef d'équipe, aux
 * directeurs de parc et aux managers (principaux ou non) du parc du ticket.
 * Appelé par le trigger trg_notifier_ticket_resolu : POST { incident_id }.
 * Un seul envoi par ticket (table notifications_tickets_envoyees).
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

function corpsMail(titre: string, lignes: [string, string][], lien: string): string {
  const details = lignes
    .map(([l, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#8b92b8;font-size:13px;vertical-align:top;white-space:nowrap;">${echapper(l)}</td><td style="padding:4px 0;color:#ffffff;font-size:14px;">${echapper(v)}</td></tr>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 24px 0;">
        <span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:28px;border-left:4px solid #22C55E;">
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:16px;">${echapper(titre)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding-bottom:20px;">${details}</table>
        <a href="${lien}" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;">Voir le ticket</a>
      </td></tr>
      <tr><td style="padding:20px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Message automatique ALBA, ne pas répondre.</td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

const nomComplet = (u: { prenom?: string | null; nom?: string | null } | null) =>
  u ? `${u.prenom ?? ""} ${u.nom ?? ""}`.trim() : "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const corps = await req.json().catch(() => ({}));
    const incidentId = typeof corps.incident_id === "string" ? corps.incident_id : null;
    if (!incidentId) return repondre({ success: false, error: "incident_id requis" }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    const { data: inc } = await service
      .from("incidents")
      .select("id, numero_bt, titre, statut, est_formation, declare_le, resolu_le, resolu_par_id, equipements(code, libelle, parc_id)")
      .eq("id", incidentId)
      .maybeSingle();
    // Seulement un vrai ticket résolu (l'appel ne fait confiance qu'à la base)
    if (!inc || inc.statut !== "resolu" || inc.est_formation) return repondre({ success: true, envoyes: 0 });
    // Pas de rattrapage des anciens tickets : résolu il y a moins d'une heure
    if (inc.resolu_le && Date.now() - new Date(inc.resolu_le).getTime() > 3600_000) return repondre({ success: true, envoyes: 0 });

    const { error: dejaEnvoye } = await service
      .from("notifications_tickets_envoyees")
      .insert({ incident_id: inc.id, evenement: "resolu" });
    if (dejaEnvoye) return repondre({ success: true, envoyes: 0, deja: true });

    const equip = inc.equipements as { code?: string; libelle?: string; parc_id?: string } | null;
    const { data: parcsTicket } = await service.rpc("parcs_du_ticket", { p_incident_id: inc.id });
    const parcIds: string[] = equip?.parc_id ? [equip.parc_id] : ((parcsTicket as string[] | null) ?? []);
    if (parcIds.length === 0) return repondre({ success: true, envoyes: 0 });

    const [{ data: parcs }, { data: liens }, { data: tech }, { data: interv }] = await Promise.all([
      service.from("parcs").select("id, nom").in("id", parcIds),
      service.from("parcs_utilisateurs").select("utilisateur_id").in("parc_id", parcIds),
      inc.resolu_par_id
        ? service.from("utilisateurs").select("prenom, nom").eq("id", inc.resolu_par_id).maybeSingle()
        : Promise.resolve({ data: null }),
      service.from("interventions").select("diagnostic, actions_realisees, debut").eq("incident_id", inc.id)
        .order("debut", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ids = [...new Set((liens ?? []).map((l: { utilisateur_id: string }) => l.utilisateur_id))];
    const [{ data: equipeParc }, { data: chefs }] = await Promise.all([
      ids.length
        ? service.from("utilisateurs").select("id, email, roles!inner(code)").eq("actif", true)
          .in("id", ids).in("roles.code", ["directeur_parc", "manager_parc"])
        : Promise.resolve({ data: [] }),
      // Chef d'équipe : tous les parcs
      service.from("utilisateurs").select("id, email, roles!inner(code)").eq("actif", true)
        .eq("roles.code", "chef_maintenance"),
    ]);
    const users = [...(equipeParc ?? []), ...(chefs ?? [])];

    const nomParc = (parcs ?? []).map((p: { nom: string }) => p.nom).join(", ");
    const equipement = [equip?.code, equip?.libelle].filter(Boolean).join(" · ");
    const technicien = nomComplet(tech as { prenom?: string; nom?: string } | null) || "Technicien";
    const duree = inc.declare_le && inc.resolu_le
      ? Math.round((new Date(inc.resolu_le).getTime() - new Date(inc.declare_le).getTime()) / 60000)
      : null;
    const dureeTexte = duree === null ? "" : duree < 60 ? `${duree} min` : duree < 1440 ? `${Math.floor(duree / 60)} h ${String(duree % 60).padStart(2, "0")}` : `${Math.floor(duree / 1440)} j ${Math.floor((duree % 1440) / 60)} h`;

    const titre = `Ticket résolu · ${inc.numero_bt} · ${nomParc}`;
    const texte = `${technicien} a résolu « ${inc.titre} »${equipement ? ` (${equipement})` : ""}${dureeTexte ? ` en ${dureeTexte}` : ""}.`;
    const url = `/gmao/operations/${inc.numero_bt}`;
    const iv = interv as { diagnostic?: string | null; actions_realisees?: string | null } | null;
    const lignes: [string, string][] = [
      ["Parc", nomParc],
      ["Ticket", `${inc.numero_bt} · ${inc.titre}`],
      ...(equipement ? [["Équipement", equipement] as [string, string]] : []),
      ["Résolu par", technicien],
      ...(dureeTexte ? [["Délai", dureeTexte] as [string, string]] : []),
      ...(iv?.diagnostic ? [["Diagnostic", iv.diagnostic] as [string, string]] : []),
      ...(iv?.actions_realisees ? [["Actions", iv.actions_realisees] as [string, string]] : []),
    ];

    let envoyes = 0;
    for (const u of users as { id: string; email: string | null }[]) {
      await service.rpc("notifier_push", { p_utilisateur_id: u.id, p_titre: titre, p_corps: texte, p_url: url });
      if (resendApiKey && u.email) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ALBA by Nikito <noreply@nikito.tech>",
            to: [u.email],
            subject: titre,
            html: corpsMail(titre, lignes, `${siteUrl}${url}`),
          }),
        });
        if (!r.ok) console.error("notifier-ticket-resolu: Resend", r.status, await r.text());
      }
      envoyes++;
    }
    return repondre({ success: true, envoyes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("notifier-ticket-resolu:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
