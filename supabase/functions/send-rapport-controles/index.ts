import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nikito.tech",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LigneControle {
  date: string;
  parc: string;
  type: string;
  controleur: string;
  statut: string;
  ok: number;
  ko: number;
  hash: string;
}

interface RapportPayload {
  destinataire_email: string;
  parc_label: string;
  date_debut: string;
  date_fin: string;
  total_controles: number;
  total_valides: number;
  total_non_conformites: number;
  lignes: LigneControle[];
}

const statutColors: Record<string, string> = {
  valide: "#4DD09E",
  en_cours: "#FFB547",
  echec: "#FF4D6D",
  remplace: "#A8A8C8",
  a_faire: "#A8A8C8",
};

const statutLabels: Record<string, string> = {
  valide: "Valid\u00e9",
  en_cours: "En cours",
  echec: "\u00c9chec",
  remplace: "Remplac\u00e9",
  a_faire: "\u00c0 faire",
};

const typeLabels: Record<string, string> = {
  quotidien: "Quotidien",
  hebdo: "Hebdo",
  mensuel: "Mensuel",
};

function buildHtml(p: RapportPayload): string {
  const tauxConf =
    p.total_controles > 0
      ? Math.round((p.total_valides / p.total_controles) * 100)
      : 0;

  const lignesHtml = p.lignes
    .map(
      (l) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#ffffff;">${l.date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#5DE5FF;font-weight:600;">${l.parc}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#ffffff;">${typeLabels[l.type] ?? l.type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#ffffff;">${l.controleur}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:${statutColors[l.statut] ?? "#A8A8C8"};font-weight:600;">${statutLabels[l.statut] ?? l.statut}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#4DD09E;text-align:center;">${l.ok}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#FF4D6D;text-align:center;">${l.ko}</td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport contr&ocirc;les ALBA</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="700" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;width:100%;">

        <tr>
          <td align="center" style="padding:0 0 24px 0;">
            <span style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span></span>
          </td>
        </tr>

        <tr>
          <td style="background-color:#131836;border-radius:16px;padding:28px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:6px;">
                  Rapport des contr&ocirc;les
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#8b92b8;padding-bottom:20px;">
                  Registre de conformit&eacute; &middot; DGCCRF
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:12px;color:#8b92b8;padding-bottom:4px;">P&eacute;riode : <strong style="color:#ffffff;">${p.date_debut} au ${p.date_fin}</strong></td>
                    </tr>
                    <tr>
                      <td style="font-size:12px;color:#8b92b8;padding-bottom:4px;">Parc : <strong style="color:#ffffff;">${p.parc_label}</strong></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total</div>
                        <div style="font-size:22px;font-weight:700;color:#5DE5FF;">${p.total_controles}</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Valid&eacute;s</div>
                        <div style="font-size:22px;font-weight:700;color:#4DD09E;">${p.total_valides}</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Non-conf.</div>
                        <div style="font-size:22px;font-weight:700;color:#FFB547;">${p.total_non_conformites}</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Conformit&eacute;</div>
                        <div style="font-size:22px;font-weight:700;color:${tauxConf >= 90 ? "#4DD09E" : tauxConf >= 70 ? "#FFB547" : "#FF4D6D"};">${tauxConf}%</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;">
                    <thead>
                      <tr style="background-color:#0a0e27;">
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Date</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Parc</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Type</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Contr&ocirc;leur</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Statut</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:center;font-weight:600;">OK</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:center;font-weight:600;">KO</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lignesHtml}
                    </tbody>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:11px;color:#6E6E96;text-align:center;line-height:20px;">
                  Ce document fait foi pour les contr&ocirc;les r&eacute;glementaires DGCCRF.
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:8px;">
                  &copy; Nikito Group &middot; GMAO &middot; G&eacute;n&eacute;r&eacute; le ${new Date().toLocaleDateString("fr-FR")}
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

    const payload: RapportPayload = await req.json();

    const html = buildHtml(payload);

    const parcSuffix = payload.parc_label !== "Tous les parcs"
      ? ` ${payload.parc_label}`
      : "";

    const subject = `Rapport contr\u00f4les ALBA${parcSuffix} \u2014 ${payload.date_debut} au ${payload.date_fin}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [payload.destinataire_email],
        subject,
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
    console.error("send-rapport-controles error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
