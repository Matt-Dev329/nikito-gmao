import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Notifications à la création d'un ticket (appelé par trg_notifier_ticket_cree,
 * POST { incident_id }) :
 *  - ticket en attente de validation : notification appli + mail au chef
 *    d'équipe et aux directeurs du parc (seuls à pouvoir valider) ;
 *  - ticket arrivé dans Opérations (créé directement ou validé) : notification
 *    appli aux techniciens du parc (selon leurs spécialités) et au chef d'équipe.
 * Un seul envoi par ticket et par événement (notifications_tickets_envoyees).
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

function corpsMail(titre: string, lignes: [string, string][], lien: string, bouton: string): string {
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
      <tr><td style="background-color:#131836;border-radius:16px;padding:28px;border-left:4px solid #FFB547;">
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:16px;">${echapper(titre)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding-bottom:20px;">${details}</table>
        <a href="${lien}" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;">${echapper(bouton)}</a>
      </td></tr>
      <tr><td style="padding:20px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Message automatique ALBA, ne pas répondre.</td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

type Destinataire = { id: string; email: string | null };

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
      .select("id, numero_bt, titre, description, statut, est_formation, est_brouillon, validation_manager, declare_le, valide_le, declare_par_nom, niveaux_priorite(code), equipements(code, libelle, parc_id, categorie_id)")
      .eq("id", incidentId)
      .maybeSingle();
    // On ne fait confiance qu'à la base : l'événement est déduit de l'état du ticket
    if (!inc || inc.est_formation || inc.est_brouillon || inc.statut === "annule") return repondre({ success: true, envoyes: 0 });
    const evenement = inc.validation_manager === "en_attente"
      ? "a_valider"
      : ["auto", "valide"].includes(inc.validation_manager ?? "") ? "nouveau" : null;
    if (!evenement) return repondre({ success: true, envoyes: 0 });
    // Pas de rattrapage des anciens tickets
    const reference = evenement === "nouveau" && inc.valide_le ? inc.valide_le : inc.declare_le;
    if (reference && Date.now() - new Date(reference).getTime() > 3600_000) return repondre({ success: true, envoyes: 0 });

    const { error: dejaEnvoye } = await service
      .from("notifications_tickets_envoyees")
      .insert({ incident_id: inc.id, evenement });
    if (dejaEnvoye) return repondre({ success: true, envoyes: 0, deja: true });

    const equip = inc.equipements as { code?: string; libelle?: string; parc_id?: string; categorie_id?: string } | null;
    const { data: parcsTicket } = await service.rpc("parcs_du_ticket", { p_incident_id: inc.id });
    const parcIds: string[] = equip?.parc_id ? [equip.parc_id] : ((parcsTicket as string[] | null) ?? []);

    const [{ data: parcs }, { data: liens }, { data: chefs }] = await Promise.all([
      parcIds.length ? service.from("parcs").select("id, nom").in("id", parcIds) : Promise.resolve({ data: [] }),
      parcIds.length
        ? service.from("parcs_utilisateurs").select("utilisateur_id, est_manager").in("parc_id", parcIds)
        : Promise.resolve({ data: [] }),
      service.from("utilisateurs").select("id, email, roles!inner(code)").eq("actif", true).eq("roles.code", "chef_maintenance"),
    ]);
    const liensParc = (liens ?? []) as { utilisateur_id: string; est_manager: boolean | null }[];
    const ids = [...new Set(liensParc.map((l) => l.utilisateur_id))];

    const { data: equipe } = ids.length
      ? await service.from("utilisateurs").select("id, email, specialites, specialites_exclues, roles!inner(code)").eq("actif", true)
        .in("id", ids).in("roles.code", ["directeur_parc", "manager_parc", "technicien"])
      : { data: [] };
    const membres = (equipe ?? []) as unknown as { id: string; email: string | null; specialites: string[] | null; specialites_exclues: string[] | null; roles: { code: string } }[];

    let destinataires: Destinataire[];
    if (evenement === "a_valider") {
      destinataires = membres.filter((u) => u.roles.code === "directeur_parc");
    } else {
      // Techniciens spécialisés : seulement les tickets de leurs catégories, sans les catégories exclues
      destinataires = membres.filter((u) =>
        u.roles.code === "technicien" &&
        (!u.specialites?.length || (!!equip?.categorie_id && u.specialites.includes(equip.categorie_id))) &&
        !(equip?.categorie_id && u.specialites_exclues?.includes(equip.categorie_id)));
    }
    const vus = new Set<string>();
    destinataires = [...destinataires, ...((chefs ?? []) as Destinataire[])].filter((u) => !vus.has(u.id) && vus.add(u.id));

    const nomParc = ((parcs ?? []) as { nom: string }[]).map((p) => p.nom).join(", ");
    const equipement = [equip?.code, equip?.libelle].filter(Boolean).join(" · ");
    const priorite = (inc.niveaux_priorite as { code?: string } | null)?.code ?? "";
    const auteur = inc.declare_par_nom || "Quelqu'un";

    const titre = evenement === "a_valider"
      ? `Ticket à valider · ${inc.numero_bt}${nomParc ? ` · ${nomParc}` : ""}`
      : `Nouveau ticket · ${inc.numero_bt}${nomParc ? ` · ${nomParc}` : ""}`;
    const texte = evenement === "a_valider"
      ? `${auteur} a signalé « ${inc.titre} »${equipement ? ` (${equipement})` : ""}. À valider avant envoi aux techniciens.`
      : `${priorite ? `[${priorite.toUpperCase()}] ` : ""}« ${inc.titre} »${equipement ? ` (${equipement})` : ""} — signalé par ${auteur}.`;
    const url = evenement === "a_valider" ? "/gmao/operations" : `/gmao/operations/${inc.numero_bt}`;

    const lignes: [string, string][] = [
      ...(nomParc ? [["Parc", nomParc] as [string, string]] : []),
      ["Ticket", `${inc.numero_bt} · ${inc.titre}`],
      ...(equipement ? [["Équipement", equipement] as [string, string]] : []),
      ...(priorite ? [["Gravité", priorite] as [string, string]] : []),
      ["Signalé par", auteur],
      ...(inc.description ? [["Détail", String(inc.description)] as [string, string]] : []),
    ];

    let envoyes = 0;
    for (const u of destinataires) {
      await service.rpc("notifier_push", { p_utilisateur_id: u.id, p_titre: titre, p_corps: texte, p_url: url });
      // Mail seulement pour les tickets à valider
      if (evenement === "a_valider" && resendApiKey && u.email) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ALBA by Nikito <noreply@nikito.tech>",
            to: [u.email],
            subject: titre,
            html: corpsMail(titre, lignes, `${siteUrl}${url}`, "Valider le ticket"),
          }),
        });
        if (!r.ok) console.error("notifier-ticket: Resend", r.status, await r.text());
      }
      envoyes++;
    }
    return repondre({ success: true, evenement, envoyes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("notifier-ticket:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
