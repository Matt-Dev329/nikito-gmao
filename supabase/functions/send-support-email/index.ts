import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SupportPayload {
  motif: string;
  objet: string;
  message: string;
  user_name: string;
  user_email: string;
}

function buildHtml(p: SupportPayload): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Demande support GMAO</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <tr>
          <td align="center" style="padding:0 0 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;text-align:center;">
                  NIKITO <span style="color:#5DE5FF;">GMAO</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:20px;">
                  Nouvelle demande de support
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;border-radius:10px;padding:16px;">
                    <tr>
                      <td style="padding:16px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-size:11px;color:#5DE5FF;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">Motif</td>
                          </tr>
                          <tr>
                            <td style="font-size:15px;color:#ffffff;padding-bottom:16px;">${p.motif}</td>
                          </tr>
                          <tr>
                            <td style="font-size:11px;color:#5DE5FF;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">Objet</td>
                          </tr>
                          <tr>
                            <td style="font-size:15px;color:#ffffff;padding-bottom:16px;">${p.objet}</td>
                          </tr>
                          <tr>
                            <td style="font-size:11px;color:#5DE5FF;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">Message</td>
                          </tr>
                          <tr>
                            <td style="font-size:14px;color:#c8c8e0;line-height:22px;">${p.message.replace(/\n/g, "<br>")}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="font-size:13px;color:#8b92b8;line-height:22px;padding-top:8px;">
                  Envoy&eacute; par <strong style="color:#ffffff;">${p.user_name}</strong> &mdash; <a href="mailto:${p.user_email}" style="color:#5DE5FF;text-decoration:none;">${p.user_email}</a>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:16px;">
                  &copy; Nikito Group &middot; GMAO
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: SupportPayload = await req.json();

    if (!payload.motif || !payload.objet || !payload.message) {
      return new Response(
        JSON.stringify({ success: false, error: "Champs requis manquants" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = `[GMAO - ${payload.motif}] ${payload.objet}`;
    const html = buildHtml(payload);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nikito GMAO <noreply@nikito.tech>",
        to: ["si@nikito.com"],
        reply_to: payload.user_email,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({ success: false, error: "Echec envoi email", detail: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-support-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
