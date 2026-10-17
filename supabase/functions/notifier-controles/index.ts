import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Notifications (appli + mail) sur les contrôles, pour le chef d'équipe, les
 * directeurs de parc et les managers principaux du parc :
 *  - { mode: "fait", controle_id } : contrôle quotidien ou hebdo validé
 *    (appelé par le trigger trg_notifier_controle_fait) ;
 *  - { mode: "verifier" } : contrôle quotidien toujours pas validé 30 min
 *    après l'ouverture du parc (appelé toutes les 10 min par pg_cron).
 * Chaque message n'est envoyé qu'une fois (table notifications_controles_envoyees).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DELAI_APRES_OUVERTURE_MIN = 30;
const LIBELLES: Record<string, string> = { quotidien: "quotidien", hebdo: "hebdomadaire" };

type Evenement = "fait" | "non_fait";

interface Parc {
  id: string;
  code: string;
  nom: string;
  horaires: Record<string, { ouverture?: string | null; fermeture?: string | null; ferme?: boolean } | undefined> | null;
  meta: { est_vacances?: boolean } | null;
}

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Date (AAAA-MM-JJ), jour de la semaine et minutes depuis minuit, heure de Paris */
function maintenantParis(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "long",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    jour: String(parts.weekday).toLowerCase(),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const enMinutes = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
};

const heureParis = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Horaires du jour (même logique que src/lib/horaires.ts, vacances comprises) */
function horairesDuJour(parc: Parc, jour: string): { ouverture: string; fermeture: string | null } | null {
  const h = parc.horaires;
  if (!h) return null;
  const vacances = parc.meta?.est_vacances ? h["vacances"] : undefined;
  const plage = vacances ?? h[jour];
  if (!plage || plage.ferme || !plage.ouverture) return null;
  return { ouverture: plage.ouverture, fermeture: plage.fermeture ?? null };
}

function corpsMail(titre: string, texte: string, couleur: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 24px 0;">
        <span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:28px;border-left:4px solid ${couleur};">
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:12px;">${echapper(titre)}</div>
        <div style="font-size:15px;color:#8b92b8;line-height:23px;padding-bottom:20px;">${echapper(texte)}</div>
        <a href="${siteUrl}/gmao/controles" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;">Voir les contrôles</a>
      </td></tr>
      <tr><td style="padding:20px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Message automatique ALBA, ne pas répondre.</td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

  /** Chef d'équipe (tous les parcs), directeurs et managers principaux du parc */
  async function destinataires(parcId: string) {
    const { data: liens } = await service
      .from("parcs_utilisateurs")
      .select("utilisateur_id, est_manager")
      .eq("parc_id", parcId);
    const duParc = new Map((liens ?? []).map((l: { utilisateur_id: string; est_manager: boolean | null }) => [l.utilisateur_id, !!l.est_manager]));
    const { data: users } = await service
      .from("utilisateurs")
      .select("id, prenom, email, roles!inner(code)")
      .eq("actif", true)
      .in("roles.code", ["chef_maintenance", "directeur_parc", "manager_parc"]);
    return (users ?? []).filter((u: { id: string; roles: unknown }) => {
      const role = (u.roles as { code: string }).code;
      if (role === "chef_maintenance") return true;
      if (role === "directeur_parc") return duParc.has(u.id);
      return duParc.get(u.id) === true;
    }) as { id: string; prenom: string; email: string | null }[];
  }

  async function envoyer(parc: { id: string; nom: string }, type: string, date: string, evenement: Evenement, titre: string, texte: string) {
    // Une seule fois par parc, type, date et événement
    const { error: dejaEnvoye } = await service
      .from("notifications_controles_envoyees")
      .insert({ parc_id: parc.id, type, date_controle: date, evenement });
    if (dejaEnvoye) return 0;

    const liste = await destinataires(parc.id);
    const couleur = evenement === "fait" ? "#22C55E" : "#FF4D6D";
    for (const u of liste) {
      await service.rpc("notifier_push", { p_utilisateur_id: u.id, p_titre: titre, p_corps: texte, p_url: "/gmao/controles" });
      if (resendApiKey && u.email) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ALBA by Nikito <noreply@nikito.tech>",
            to: [u.email],
            subject: titre,
            html: corpsMail(titre, texte, couleur, siteUrl),
          }),
        });
        if (!r.ok) console.error("notifier-controles: Resend", r.status, await r.text());
      }
    }
    return liste.length;
  }

  try {
    const corps = await req.json().catch(() => ({}));

    if (corps.mode === "fait") {
      const { data: c } = await service
        .from("controles")
        .select("id, parc_id, type, date_planifiee, statut, est_formation, realise_par_nom, date_validation, parcs(id, nom)")
        .eq("id", String(corps.controle_id ?? ""))
        .maybeSingle();
      if (!c || c.statut !== "valide" || c.est_formation || !["quotidien", "hebdo"].includes(c.type)) {
        return repondre({ success: true, envoye: 0 });
      }
      const parc = c.parcs as unknown as { id: string; nom: string };
      const heure = c.date_validation ? ` à ${heureParis(c.date_validation)}` : "";
      const par = c.realise_par_nom ? ` par ${c.realise_par_nom}` : "";
      const n = await envoyer(
        parc,
        c.type,
        c.date_planifiee,
        "fait",
        `✅ Contrôle ${LIBELLES[c.type]} fait · ${parc.nom}`,
        `Le contrôle ${LIBELLES[c.type]} de ${parc.nom} a été validé${heure}${par}.`,
      );
      return repondre({ success: true, envoye: n });
    }

    if (corps.mode === "verifier") {
      const now = maintenantParis();
      const { data: parcs } = await service
        .from("parcs")
        .select("id, code, nom, horaires, meta")
        .eq("actif", true)
        .eq("en_production", true)
        .neq("code", "ECO");
      let alertes = 0;
      for (const parc of (parcs ?? []) as Parc[]) {
        const h = horairesDuJour(parc, now.jour);
        if (!h) continue;
        const limite = enMinutes(h.ouverture) + DELAI_APRES_OUVERTURE_MIN;
        if (now.minutes < limite || (h.fermeture && now.minutes > enMinutes(h.fermeture))) continue;
        const { count } = await service
          .from("controles")
          .select("id", { count: "exact", head: true })
          .eq("parc_id", parc.id)
          .eq("type", "quotidien")
          .eq("date_planifiee", now.date)
          .eq("statut", "valide")
          .eq("est_formation", false);
        if ((count ?? 0) > 0) continue;
        const n = await envoyer(
          parc,
          "quotidien",
          now.date,
          "non_fait",
          `⚠️ Contrôle quotidien pas fait · ${parc.nom}`,
          `Le contrôle quotidien de ${parc.nom} n'est toujours pas validé, ${DELAI_APRES_OUVERTURE_MIN} minutes après l'ouverture (${h.ouverture.slice(0, 5)}).`,
        );
        if (n) alertes++;
      }
      return repondre({ success: true, alertes });
    }

    return repondre({ success: false, error: "mode inconnu" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("notifier-controles:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
