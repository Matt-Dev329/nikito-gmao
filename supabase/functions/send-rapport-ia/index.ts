import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EquipementResume {
  code: string;
  libelle: string;
  parc: string;
  score: number;
  priorite: string;
  action: string;
}

interface AlerteResume {
  type: string;
  message: string;
  parc: string;
  priorite: string;
}

interface KpiPredictions {
  mtbf_prevu_30j: number;
  incidents_prevus_30j: number;
  taux_conformite_prevu: number;
  equipements_necessitant_attention: number;
}

interface RapportIAPayload {
  destinataire_email: string;
  score_sante: number;
  tendance: string;
  nb_equipements_risque: number;
  nb_alertes: number;
  nb_recommandations: number;
  kpi: KpiPredictions;
  equipements_risque: EquipementResume[];
  alertes: AlerteResume[];
  pdf_base64: string;
}

const tendanceLabels: Record<string, string> = {
  amelioration: "En am\u00e9lioration",
  stable: "Stable",
  degradation: "En d\u00e9gradation",
};

const prioriteColors: Record<string, string> = {
  haute: "#FF4D6D",
  moyenne: "#FFB547",
  basse: "#5DE5FF",
};

function scoreColor(score: number): string {
  if (score >= 80) return "#4DD09E";
  if (score >= 50) return "#FFB547";
  return "#FF4D6D";
}

function buildHtml(p: RapportIAPayload): string {
  const eqRows = p.equipements_risque
    .map(
      (eq) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#5DE5FF;font-weight:600;">${eq.code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#ffffff;">${eq.libelle}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:#ffffff;">${eq.parc}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:13px;color:${prioriteColors[eq.priorite] ?? "#A8A8C8"};font-weight:600;">${eq.score}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1a1f4e;font-size:12px;color:#ffffff;">${eq.action}</td>
    </tr>`
    )
    .join("\n");

  const alertRows = p.alertes
    .map(
      (a) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f4e;font-size:12px;color:${prioriteColors[a.priorite] ?? "#A8A8C8"};font-weight:600;">${a.priorite.toUpperCase()}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f4e;font-size:12px;color:#ffffff;">${a.message}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f4e;font-size:12px;color:#8b92b8;">${a.parc}</td>
    </tr>`
    )
    .join("\n");

  const confColor = p.kpi.taux_conformite_prevu >= 90 ? "#4DD09E" : p.kpi.taux_conformite_prevu >= 70 ? "#FFB547" : "#FF4D6D";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport IA Pr&eacute;dictive ALBA</title>
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
                  Rapport IA Pr&eacute;dictive
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#8b92b8;padding-bottom:20px;">
                  Analyse automatique de maintenance &middot; G&eacute;n&eacute;r&eacute; le ${new Date().toLocaleDateString("fr-FR")}
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Sant&eacute;</div>
                        <div style="font-size:22px;font-weight:700;color:${scoreColor(p.score_sante)};">${p.score_sante}/100</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Tendance</div>
                        <div style="font-size:14px;font-weight:600;color:#ffffff;">${tendanceLabels[p.tendance] ?? p.tendance}</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Conformit&eacute;</div>
                        <div style="font-size:22px;font-weight:700;color:${confColor};">${Math.round(p.kpi.taux_conformite_prevu)}%</div>
                      </td>
                      <td width="4"></td>
                      <td width="25%" style="background-color:#0a0e27;border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Incidents 30j</div>
                        <div style="font-size:22px;font-weight:700;color:${p.kpi.incidents_prevus_30j > 10 ? "#FF4D6D" : "#FFB547"};">${p.kpi.incidents_prevus_30j}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              ${p.equipements_risque.length > 0 ? `
              <tr>
                <td style="font-size:14px;color:#ffffff;font-weight:600;padding-bottom:8px;padding-top:8px;">
                  &Eacute;quipements &agrave; risque (${p.nb_equipements_risque})
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;">
                    <thead>
                      <tr style="background-color:#0a0e27;">
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Code</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">&Eacute;quipement</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Parc</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Risque</th>
                        <th style="padding:10px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Action</th>
                      </tr>
                    </thead>
                    <tbody>${eqRows}</tbody>
                  </table>
                </td>
              </tr>` : ""}

              ${p.alertes.length > 0 ? `
              <tr>
                <td style="font-size:14px;color:#ffffff;font-weight:600;padding-bottom:8px;padding-top:20px;">
                  Alertes (${p.nb_alertes})
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;">
                    <thead>
                      <tr style="background-color:#0a0e27;">
                        <th style="padding:8px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Priorit&eacute;</th>
                        <th style="padding:8px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Message</th>
                        <th style="padding:8px 12px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Parc</th>
                      </tr>
                    </thead>
                    <tbody>${alertRows}</tbody>
                  </table>
                </td>
              </tr>` : ""}

              ${p.nb_recommandations > 0 ? `
              <tr>
                <td style="font-size:13px;color:#8b92b8;padding-top:20px;padding-bottom:4px;">
                  ${p.nb_recommandations} recommandation${p.nb_recommandations > 1 ? "s" : ""} incluse${p.nb_recommandations > 1 ? "s" : ""} dans le PDF joint.
                </td>
              </tr>` : ""}

            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#131836;border-radius:12px;padding:16px;">
              <tr>
                <td style="padding:16px;text-align:center;">
                  <div style="font-size:12px;color:#5DE5FF;font-weight:600;margin-bottom:4px;">Rapport PDF joint</div>
                  <div style="font-size:11px;color:#8b92b8;">Le rapport complet avec tous les d&eacute;tails est joint &agrave; cet email en pi&egrave;ce jointe PDF.</div>
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
                  Ce rapport a &eacute;t&eacute; g&eacute;n&eacute;r&eacute; automatiquement par l'IA pr&eacute;dictive ALBA.
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:8px;">
                  &copy; Nikito Group &middot; GMAO ALBA &middot; ${new Date().toLocaleDateString("fr-FR")}
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

    const payload: RapportIAPayload = await req.json();

    const html = buildHtml(payload);

    const dateStr = new Date().toLocaleDateString("fr-FR");
    const subject = `Rapport IA Pr\u00e9dictive ALBA \u2014 ${dateStr} \u2014 Sant\u00e9 ${payload.score_sante}/100`;

    const emailPayload: Record<string, unknown> = {
      from: "ALBA by Nikito <noreply@nikito.tech>",
      to: [payload.destinataire_email],
      subject,
      html,
    };

    if (payload.pdf_base64) {
      emailPayload.attachments = [
        {
          filename: `rapport_ia_predictive_${new Date().toISOString().slice(0, 10)}.pdf`,
          content: payload.pdf_base64,
        },
      ];
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
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
    console.error("send-rapport-ia error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
