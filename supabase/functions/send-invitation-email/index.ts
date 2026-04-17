import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationPayload {
  destinataire_email: string;
  destinataire_prenom: string;
  destinataire_nom: string;
  role_label: string;
  invitant_prenom: string;
  invitant_nom: string;
  lien_invitation: string;
  parcs_labels: string[];
}

function buildHtml(p: InvitationPayload): string {
  const parcsText = p.parcs_labels.join(", ");

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
                  Bonjour ${p.destinataire_prenom},
                </td>
              </tr>

              <tr>
                <td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:12px;">
                  <strong style="color:#ffffff;">${p.invitant_prenom} ${p.invitant_nom}</strong> vous invite &agrave; rejoindre ALBA by Nikito en tant que <strong style="color:#5DE5FF;">${p.role_label}</strong>.
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
                        <a href="${p.lien_invitation}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                          Accepter l'invitation
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

    const payload: InvitationPayload = await req.json();

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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-invitation-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
