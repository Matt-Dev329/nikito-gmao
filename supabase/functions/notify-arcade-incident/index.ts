import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ArcadeIncidentPayload {
  incident_id: string;
  numero_bt: string;
  titre: string;
  description: string | null;
  symptome: string | null;
  statut: string;
  priorite: string;
  equipement_code: string;
  equipement_libelle: string;
  parc_nom: string;
  parc_code: string;
  declare_le: string;
  declare_par_nom: string | null;
}

function buildHtml(p: ArcadeIncidentPayload): string {
  const prioriteColor =
    p.priorite === "Bloquant"
      ? "#FF4D6D"
      : p.priorite === "Majeur"
        ? "#FFB547"
        : "#5DE5FF";

  const dateStr = new Date(p.declare_le).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Incident Arcade — ${p.numero_bt}</title>
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

              <!-- Alert badge -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <span style="display:inline-block;background-color:${prioriteColor};color:#0a0e27;font-size:12px;font-weight:700;text-transform:uppercase;padding:6px 16px;border-radius:20px;letter-spacing:1px;">
                    Incident ${p.priorite}
                  </span>
                </td>
              </tr>

              <tr>
                <td style="font-size:20px;color:#ffffff;font-weight:700;text-align:center;padding-bottom:24px;">
                  ${p.numero_bt} &mdash; ${p.titre}
                </td>
              </tr>

              <!-- Info table -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1e2344;border-radius:10px;overflow:hidden;">
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;width:140px;">
                        &Eacute;quipement
                      </td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;font-weight:600;">
                        ${p.equipement_code} &mdash; ${p.equipement_libelle}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">
                        Parc
                      </td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">
                        ${p.parc_nom} (${p.parc_code})
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">
                        D&eacute;clar&eacute; le
                      </td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">
                        ${dateStr}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">
                        D&eacute;clar&eacute; par
                      </td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">
                        ${p.declare_par_nom ?? "Syst&egrave;me"}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;">
                        Statut
                      </td>
                      <td style="padding:12px 16px;font-size:14px;color:#5DE5FF;font-weight:600;">
                        ${p.statut.toUpperCase()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              ${
                p.description
                  ? `<tr>
                <td style="padding-bottom:16px;">
                  <div style="font-size:13px;color:#8b92b8;padding-bottom:6px;">Description</div>
                  <div style="font-size:14px;color:#ffffff;line-height:22px;background-color:#0a0e27;border-radius:8px;padding:12px 16px;">
                    ${p.description}
                  </div>
                </td>
              </tr>`
                  : ""
              }

              ${
                p.symptome
                  ? `<tr>
                <td style="padding-bottom:16px;">
                  <div style="font-size:13px;color:#8b92b8;padding-bottom:6px;">Sympt&ocirc;me</div>
                  <div style="font-size:14px;color:#ffffff;line-height:22px;background-color:#0a0e27;border-radius:8px;padding:12px 16px;">
                    ${p.symptome}
                  </div>
                </td>
              </tr>`
                  : ""
              }

              <tr>
                <td style="font-size:13px;color:#8b92b8;text-align:center;padding-top:12px;line-height:20px;">
                  Cet &eacute;quipement n&eacute;cessite peut-&ecirc;tre une intervention du fournisseur arcade.
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
                  Cet email a &eacute;t&eacute; envoy&eacute; automatiquement par ALBA, ne pas r&eacute;pondre.
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: ArcadeIncidentPayload = await req.json();

    const html = buildHtml(payload);
    const subject = `[ALBA] Incident Arcade ${payload.priorite} — ${payload.numero_bt} — ${payload.equipement_code} (${payload.parc_code})`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: ["joachim.miloche@ja-fg.com", "lili.marie.pellerin@ja-fg.com"],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("[notify-arcade-incident] Resend error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Echec envoi email",
          resend_status: resendRes.status,
          resend_response: errBody,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendRes.json();
    console.log("[notify-arcade-incident] Email envoye:", resendData.id, "pour", payload.numero_bt);

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-arcade-incident] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
