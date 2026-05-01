import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type NotificationType =
  | "prescription_creee"
  | "prescription_levee"
  | "commission_creee"
  | "commission_pv_recu"
  | "phase_changement"
  | "prescription_j30"
  | "prescription_j7"
  | "prescription_j1"
  | "prescription_retard"
  | "commission_a_venir_j7"
  | "commission_a_venir_j1"
  | "toutes_reserves_levees";

interface Payload {
  notification_id?: string;
  destinataire_email?: string;
  destinataire_prenom?: string | null;
  type_notification: NotificationType;
  titre: string;
  message: string;
  parc_nom?: string | null;
  prescription?: {
    numero?: string | null;
    intitule?: string | null;
    gravite?: string | null;
    delai_levee?: string | null;
  } | null;
  commission?: {
    type?: string | null;
    date_visite?: string | null;
    resultat?: string | null;
  } | null;
  link_path?: string | null;
}

const BRAND_COLORS = {
  bg: "#0a0e27",
  card: "#131836",
  text: "#ffffff",
  dim: "#8b92b8",
  cyan: "#5DE5FF",
  red: "#ff4d5f",
  amber: "#f6b04d",
  green: "#3ce08a",
};

function toneColor(type: NotificationType): string {
  if (type === "prescription_retard" || type === "commission_a_venir_j1" || type === "prescription_j1") return BRAND_COLORS.red;
  if (type === "prescription_j7" || type === "commission_a_venir_j7") return BRAND_COLORS.amber;
  if (type === "prescription_levee" || type === "toutes_reserves_levees") return BRAND_COLORS.green;
  return BRAND_COLORS.cyan;
}

function subjectFor(p: Payload): string {
  switch (p.type_notification) {
    case "prescription_retard":
      return `[ALBA] Reserve en RETARD - ${p.prescription?.numero ?? ""}`;
    case "prescription_j1":
      return `[ALBA] Reserve echeance DEMAIN - ${p.prescription?.numero ?? ""}`;
    case "prescription_j7":
      return `[ALBA] Reserve echeance dans 7 jours - ${p.prescription?.numero ?? ""}`;
    case "prescription_j30":
      return `[ALBA] Reserve echeance dans 30 jours - ${p.prescription?.numero ?? ""}`;
    case "prescription_creee":
      return `[ALBA] Nouvelle reserve - ${p.prescription?.numero ?? ""}`;
    case "prescription_levee":
      return `[ALBA] Reserve levee - ${p.prescription?.numero ?? ""}`;
    case "commission_creee":
      return `[ALBA] Commission ${p.commission?.type ?? ""} planifiee`;
    case "commission_a_venir_j7":
      return `[ALBA] Commission dans 7 jours`;
    case "commission_a_venir_j1":
      return `[ALBA] Commission DEMAIN`;
    case "commission_pv_recu":
      return `[ALBA] PV commission recu`;
    case "phase_changement":
      return `[ALBA] Changement de phase parc`;
    case "toutes_reserves_levees":
      return `[ALBA] Toutes les reserves sont levees`;
    default:
      return `[ALBA] ${p.titre}`;
  }
}

function buildHtml(p: Payload): string {
  const greeting = p.destinataire_prenom ? `Bonjour ${p.destinataire_prenom},` : "Bonjour,";
  const accent = toneColor(p.type_notification);
  const appBase = "https://nikito.tech";
  const linkPath = p.link_path ?? "/gmao/conformite";
  const ctaUrl = `${appBase}${linkPath}`;

  const detailsRows: string[] = [];
  if (p.parc_nom) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Parc</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.parc_nom}</td></tr>`);
  if (p.prescription?.numero) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Reserve</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.prescription.numero}</td></tr>`);
  if (p.prescription?.gravite) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Gravite</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.prescription.gravite}</td></tr>`);
  if (p.prescription?.delai_levee) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Delai</td><td style="padding:4px 0;color:${accent};text-align:right;font-weight:600;">${p.prescription.delai_levee}</td></tr>`);
  if (p.commission?.type) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Type</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.commission.type}</td></tr>`);
  if (p.commission?.date_visite) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Date</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.commission.date_visite}</td></tr>`);
  if (p.commission?.resultat) detailsRows.push(`<tr><td style="padding:4px 0;color:${BRAND_COLORS.dim};">Resultat</td><td style="padding:4px 0;color:${BRAND_COLORS.text};text-align:right;">${p.commission.resultat}</td></tr>`);

  const detailsHtml = detailsRows.length > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;margin:12px 0 20px 0;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:8px 0;">${detailsRows.join("")}</table>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${p.titre}</title></head>
<body style="margin:0;padding:0;background-color:${BRAND_COLORS.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.bg};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 24px 0;">
        <div style="font-size:22px;font-weight:700;letter-spacing:4px;color:${BRAND_COLORS.text};">
          <span style="color:${BRAND_COLORS.cyan};">A</span>LBA <span style="color:${BRAND_COLORS.dim};font-size:13px;font-weight:400;">by Nikito</span>
        </div>
      </td></tr>
      <tr><td style="background-color:${BRAND_COLORS.card};border-radius:16px;padding:32px 28px;border-left:3px solid ${accent};">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:12px;">Conformite ERP</div>
        <div style="font-size:18px;color:${BRAND_COLORS.text};font-weight:600;margin-bottom:8px;">${p.titre}</div>
        <div style="font-size:13px;color:${BRAND_COLORS.dim};margin-bottom:16px;">${greeting}</div>
        <div style="font-size:14px;color:${BRAND_COLORS.text};line-height:22px;">${p.message}</div>
        ${detailsHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;">
          <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff4d8b,${BRAND_COLORS.cyan});">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Ouvrir ALBA</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 0 0 0;font-size:11px;color:${BRAND_COLORS.dim};text-align:center;line-height:18px;">
        Notification automatique ALBA - ne pas repondre.<br>&copy; Nikito Group
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY non configuree" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: Payload = await req.json();

    let email = payload.destinataire_email ?? null;
    let prenom = payload.destinataire_prenom ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!email && payload.notification_id) {
      const { data: notif } = await supabase
        .from("notifications_conformite")
        .select("destinataire_id, parc_id, prescription_id, commission_id, type_notification, titre, message")
        .eq("id", payload.notification_id)
        .maybeSingle();

      if (!notif) {
        return new Response(
          JSON.stringify({ success: false, error: "Notification introuvable" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: dest } = await supabase
        .from("utilisateurs")
        .select("email, prenom")
        .eq("id", notif.destinataire_id)
        .maybeSingle();

      email = dest?.email ?? null;
      prenom = dest?.prenom ?? null;

      if (payload.parc_nom === undefined && notif.parc_id) {
        const { data: parc } = await supabase.from("parcs").select("nom").eq("id", notif.parc_id).maybeSingle();
        payload.parc_nom = parc?.nom ?? null;
      }

      if (!payload.prescription && notif.prescription_id) {
        const { data: p } = await supabase
          .from("prescriptions_securite")
          .select("numero_prescription, intitule, gravite, delai_levee")
          .eq("id", notif.prescription_id)
          .maybeSingle();
        if (p) {
          payload.prescription = {
            numero: p.numero_prescription,
            intitule: p.intitule,
            gravite: p.gravite,
            delai_levee: p.delai_levee,
          };
        }
      }

      if (!payload.commission && notif.commission_id) {
        const { data: c } = await supabase
          .from("commissions_securite")
          .select("type_commission, date_visite, resultat")
          .eq("id", notif.commission_id)
          .maybeSingle();
        if (c) {
          payload.commission = {
            type: c.type_commission,
            date_visite: c.date_visite,
            resultat: c.resultat,
          };
        }
      }

      if (!payload.link_path) {
        payload.link_path = notif.prescription_id
          ? "/gmao/conformite/reserves"
          : notif.commission_id
            ? "/gmao/conformite/commissions"
            : "/gmao/conformite";
      }
    }

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email destinataire manquant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    payload.destinataire_prenom = prenom;

    const html = buildHtml(payload);
    const subject = subjectFor(payload);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({ success: false, error: "Echec envoi email", resend_status: resendRes.status, resend_response: errBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();

    if (payload.notification_id) {
      await supabase
        .from("notifications_conformite")
        .update({ email_envoye: true, email_envoye_le: new Date().toISOString() })
        .eq("id", payload.notification_id);
    }

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-conformite-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
