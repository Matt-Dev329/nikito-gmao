import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Mail d'invitation à ALBA. Réservé aux comptes qui peuvent inviter
 * (direction, admin IT, chef d'équipe, directeurs et managers de parc) ou au
 * service. Le contenu (lien, rôle, parcs) est reconstruit depuis l'invitation
 * en attente en base : seul l'email du destinataire est repris de la requête.
 */

const ROLES_INVITANTS = ["direction", "admin_it", "chef_maintenance", "directeur_parc", "manager_parc"];
const LIBELLES_ROLES: Record<string, string> = {
  direction: "Direction",
  chef_maintenance: "Chef d'équipe",
  directeur_parc: "Directeur de parc",
  manager_parc: "Manager parc",
  technicien: "Technicien",
  staff_operationnel: "Staff opérationnel",
  admin_it: "Admin IT",
};
const LIBELLES_PROFILS: Record<string, string> = { arcade: "Technicien Arcade", nikito: "Technicien Nikito" };

const esc = (t: string | null | undefined) =>
  (t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const allowedOrigins = ["https://nikito.tech", "https://nikito.tech:443"];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

interface InvitationPayload {
  destinataire_email: string;
  destinataire_prenom?: string | null;
  destinataire_nom?: string | null;
  role_label: string;
  invitant_prenom: string;
  invitant_nom: string;
  lien_invitation: string;
  parcs_labels: string[];
}

function buildHtml(p: InvitationPayload): string {
  const parcsText = esc(p.parcs_labels.join(", "));
  const greeting = p.destinataire_prenom
    ? `Bonjour ${esc(p.destinataire_prenom)},`
    : "Bonjour,";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invitation ALBA by Nikito</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:0 0 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;text-align:center;">
                  <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:20px;">
                  ${greeting}
                </td>
              </tr>

              <tr>
                <td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:12px;">
                  <strong style="color:#ffffff;">${esc(p.invitant_prenom)} ${esc(p.invitant_nom)}</strong> vous invite &agrave; rejoindre ALBA by Nikito en tant que <strong style="color:#5DE5FF;">${esc(p.role_label)}</strong>.
                </td>
              </tr>

              <tr>
                <td style="font-size:14px;color:#8b92b8;line-height:22px;padding-bottom:28px;">
                  Vous aurez acc&egrave;s aux parcs suivants&nbsp;: <strong style="color:#ffffff;">${parcsText}</strong>
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff4d8b,#5DE5FF);">
                        <a href="${esc(p.lien_invitation)}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                          Cr\u00e9er mon compte
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="font-size:12px;color:#8b92b8;text-align:center;padding-bottom:0;">
                  Ce lien expire dans 7 jours.
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:11px;color:#8b92b8;text-align:center;line-height:20px;">
                  Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce mail.
                </td>
              </tr>
              <tr>
                <td style="font-size:11px;color:#8b92b8;text-align:center;line-height:20px;padding-top:4px;">
                  Cet email a &eacute;t&eacute; envoy&eacute; automatiquement, ne pas r&eacute;pondre.
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:16px;">
                  &copy; Nikito Group &middot; ALBA
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY non configuree" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const repondre = (corps: unknown, status = 200) =>
      new Response(JSON.stringify(corps), { status, headers: { ...cors, "Content-Type": "application/json" } });

    // Appelant : service, ou utilisateur connecté qui peut inviter
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let invitant: { prenom: string; nom: string } | null = null;
    if (jeton !== serviceKey) {
      const { data: auth } = await service.auth.getUser(jeton);
      if (!auth?.user) return repondre({ success: false, error: "Non authentifié" }, 401);
      const { data: moi } = await service
        .from("utilisateurs")
        .select("prenom, nom, actif, roles!inner(code)")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      const role = (moi?.roles as unknown as { code: string } | null)?.code ?? "";
      if (!moi?.actif || !ROLES_INVITANTS.includes(role)) {
        return repondre({ success: false, error: "Accès refusé" }, 403);
      }
      invitant = { prenom: moi.prenom, nom: moi.nom };
    }

    const demande = await req.json().catch(() => ({}));
    const email = typeof demande.destinataire_email === "string" ? demande.destinataire_email.trim().toLowerCase() : "";
    if (!email) return repondre({ success: false, error: "destinataire_email requis" }, 400);

    // Invitation en attente pour cet email : le contenu du mail vient de la base
    const { data: invitation } = await service
      .from("invitations")
      .select("token, email, prenom, nom, parcs_assignes, profil_technicien, roles(code), invite_par:utilisateurs!invitations_invite_par_id_fkey(prenom, nom)")
      .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
      .is("utilise_le", null)
      .gt("expire_le", new Date().toISOString())
      .order("invite_le", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!invitation) return repondre({ success: false, error: "Aucune invitation en attente pour cet email" }, 404);

    const roleInvite = (invitation.roles as unknown as { code: string } | null)?.code ?? "";
    const parcsIds = (invitation.parcs_assignes as string[] | null) ?? [];
    const { data: parcs } = parcsIds.length
      ? await service.from("parcs").select("code").in("id", parcsIds).order("code")
      : { data: [] };
    const auteur = invitant ?? (invitation.invite_par as unknown as { prenom: string; nom: string } | null) ?? { prenom: "Ryad", nom: "Neki" };

    const payload: InvitationPayload = {
      destinataire_email: invitation.email as string,
      destinataire_prenom: invitation.prenom as string | null,
      destinataire_nom: invitation.nom as string | null,
      role_label:
        roleInvite === "technicien" && LIBELLES_PROFILS[invitation.profil_technicien as string]
          ? LIBELLES_PROFILS[invitation.profil_technicien as string]
          : LIBELLES_ROLES[roleInvite] ?? roleInvite,
      invitant_prenom: auteur.prenom,
      invitant_nom: auteur.nom,
      lien_invitation: `https://nikito.tech/invitation/${invitation.token}`,
      parcs_labels: ((parcs ?? []) as { code: string }[]).map((p) => p.code),
    };

    const html = buildHtml(payload);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [payload.destinataire_email],
        subject: "Vous \u00eates invit\u00e9 \u00e0 rejoindre ALBA by Nikito",
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Echec envoi email",
          resend_status: resendRes.status,
          resend_response: errBody,
          from_used: "noreply@nikito.tech",
          to_used: payload.destinataire_email,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-invitation-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
