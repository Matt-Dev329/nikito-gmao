import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

interface CodePayload {
  email: string;
  code: string;
  prenom: string;
}

function buildHtml(p: CodePayload): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code de verification ALBA</title>
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
                  <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
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
                  Bonjour ${p.prenom},
                </td>
              </tr>

              <tr>
                <td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:24px;">
                  Votre code de v&eacute;rification est&nbsp;:
                </td>
              </tr>

              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color:#0a0e27;border-radius:12px;padding:20px 40px;border:1px solid rgba(93,229,255,0.3);">
                        <span style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#5DE5FF;">
                          ${p.code}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="font-size:13px;color:#8b92b8;text-align:center;line-height:20px;padding-bottom:0;">
                  Ce code expire dans <strong style="color:#ffffff;">10 minutes</strong>.<br>
                  Si vous n'avez pas demand&eacute; ce code, ignorez ce message.
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:4px;">
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

    const payload: CodePayload = await req.json();

    const html = buildHtml(payload);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [payload.email],
        subject: "Votre code de v\u00e9rification ALBA",
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({ success: false, error: "Echec envoi email", resend_status: resendRes.status }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-code-2fa error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
