import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PieceUtilisee {
  nom: string;
  reference: string | null;
  quantite: number;
}

interface ArcadeResoluPayload {
  incident_id: string;
  numero_bt: string;
  titre: string;
  description: string | null;
  equipement_code: string;
  equipement_libelle: string;
  numero_reader: string | null;
  numero_serie: string | null;
  categorie_nom: string | null;
  parc_nom: string;
  parc_code: string;
  priorite: string;
  declare_le: string;
  declare_par_nom: string | null;
  resolu_le: string | null;
  resolu_par_nom: string | null;
  duree_minutes: number | null;
  diagnostic: string | null;
  actions_realisees: string | null;
  resolu_premier_coup: boolean | null;
  technicien_nom: string | null;
  binome_nom: string | null;
  debut_intervention: string | null;
  fin_intervention: string | null;
  pieces_utilisees: PieceUtilisee[];
}

function formatDuree(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "N/A";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  const j = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${j}j ${rh}h` : `${j}j`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function buildHtml(p: ArcadeResoluPayload): string {
  const dateDeclaration = formatDate(p.declare_le);
  const dateResolution = formatDate(p.resolu_le);
  const dureeStr = formatDuree(p.duree_minutes);

  const interventionDureeMin =
    p.debut_intervention && p.fin_intervention
      ? Math.round(
          (new Date(p.fin_intervention).getTime() -
            new Date(p.debut_intervention).getTime()) /
            60000
        )
      : null;

  const piecesHtml =
    p.pieces_utilisees && p.pieces_utilisees.length > 0
      ? p.pieces_utilisees
          .map(
            (pc) =>
              `<tr>
              <td style="padding:8px 12px;font-size:13px;color:#ffffff;border-bottom:1px solid #1e2344;">
                ${pc.nom}${pc.reference ? ` <span style="color:#8b92b8;">(${pc.reference})</span>` : ""}
              </td>
              <td style="padding:8px 12px;font-size:13px;color:#5DE5FF;border-bottom:1px solid #1e2344;text-align:center;font-weight:600;">
                x${pc.quantite}
              </td>
            </tr>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panne resolue — ${p.numero_bt}</title>
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

              <!-- Success badge -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <span style="display:inline-block;background-color:#22C55E;color:#0a0e27;font-size:12px;font-weight:700;text-transform:uppercase;padding:6px 16px;border-radius:20px;letter-spacing:1px;">
                    Panne resolue
                  </span>
                </td>
              </tr>

              <tr>
                <td style="font-size:20px;color:#ffffff;font-weight:700;text-align:center;padding-bottom:24px;">
                  ${p.numero_bt} &mdash; ${p.titre}
                </td>
              </tr>

              <!-- Duration highlight -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#22C55E15;border:1px solid #22C55E40;border-radius:10px;">
                    <tr>
                      <td style="padding:16px 20px;text-align:center;">
                        <div style="font-size:11px;color:#22C55E;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;padding-bottom:6px;">Dur&eacute;e totale de panne</div>
                        <div style="font-size:28px;color:#22C55E;font-weight:800;">${dureeStr}</div>
                        ${p.resolu_par_nom ? `<div style="font-size:12px;color:#8b92b8;padding-top:6px;">R&eacute;solu par ${p.resolu_par_nom}</div>` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Equipment info table -->
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
                    ${
    p.numero_reader
      ? `<tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">N&deg; Reader</td>
                      <td style="padding:12px 16px;font-size:14px;color:#5DE5FF;border-bottom:1px solid #1e2344;font-weight:700;letter-spacing:0.5px;">${p.numero_reader}</td>
                    </tr>`
      : ""
  }
                    ${
    p.numero_serie
      ? `<tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">N&deg; S&eacute;rie</td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">${p.numero_serie}</td>
                    </tr>`
      : ""
  }
                    ${
    p.categorie_nom
      ? `<tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">Cat&eacute;gorie</td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">${p.categorie_nom}</td>
                    </tr>`
      : ""
  }
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">Parc</td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">${p.parc_nom} (${p.parc_code})</td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">D&eacute;clar&eacute; le</td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;border-bottom:1px solid #1e2344;">${dateDeclaration}</td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;border-bottom:1px solid #1e2344;">R&eacute;solu le</td>
                      <td style="padding:12px 16px;font-size:14px;color:#22C55E;border-bottom:1px solid #1e2344;font-weight:600;">${dateResolution}</td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;font-size:13px;color:#8b92b8;">Priorit&eacute;</td>
                      <td style="padding:12px 16px;font-size:14px;color:#ffffff;">${p.priorite}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Intervention details section -->
              ${
    p.diagnostic || p.actions_realisees || p.technicien_nom
      ? `<tr>
                <td style="padding-bottom:8px;">
                  <div style="font-size:14px;color:#5DE5FF;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding-bottom:12px;border-bottom:1px solid #1e2344;">
                    D&eacute;tails de l'intervention
                  </div>
                </td>
              </tr>

              <!-- Technician -->
              ${
          p.technicien_nom
            ? `<tr>
                <td style="padding:12px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:13px;color:#8b92b8;padding-bottom:4px;">Technicien</td>
                    </tr>
                    <tr>
                      <td style="font-size:14px;color:#ffffff;font-weight:600;">
                        ${p.technicien_nom}${p.binome_nom ? ` <span style="color:#8b92b8;font-weight:400;">+ ${p.binome_nom}</span>` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`
            : ""
        }

              <!-- Intervention duration -->
              ${
          interventionDureeMin
            ? `<tr>
                <td style="padding:8px 0 12px 0;">
                  <span style="font-size:13px;color:#8b92b8;">Dur&eacute;e intervention : </span>
                  <span style="font-size:14px;color:#ffffff;font-weight:600;">${formatDuree(interventionDureeMin)}</span>
                </td>
              </tr>`
            : ""
        }

              <!-- Premier coup -->
              ${
          p.resolu_premier_coup !== null
            ? `<tr>
                <td style="padding:4px 0 12px 0;">
                  <span style="font-size:13px;color:#8b92b8;">R&eacute;solu du premier coup : </span>
                  <span style="font-size:14px;color:${p.resolu_premier_coup ? "#22C55E" : "#FFB547"};font-weight:600;">
                    ${p.resolu_premier_coup ? "Oui" : "Non"}
                  </span>
                </td>
              </tr>`
            : ""
        }

              <!-- Diagnostic -->
              ${
          p.diagnostic
            ? `<tr>
                <td style="padding:12px 0;">
                  <div style="font-size:13px;color:#8b92b8;padding-bottom:6px;">Diagnostic</div>
                  <div style="font-size:14px;color:#ffffff;line-height:22px;background-color:#0a0e27;border-radius:8px;padding:12px 16px;">
                    ${p.diagnostic}
                  </div>
                </td>
              </tr>`
            : ""
        }

              <!-- Actions realisees -->
              ${
          p.actions_realisees
            ? `<tr>
                <td style="padding:12px 0;">
                  <div style="font-size:13px;color:#8b92b8;padding-bottom:6px;">Actions r&eacute;alis&eacute;es</div>
                  <div style="font-size:14px;color:#ffffff;line-height:22px;background-color:#0a0e27;border-radius:8px;padding:12px 16px;">
                    ${p.actions_realisees}
                  </div>
                </td>
              </tr>`
            : ""
        }

              <!-- Pieces utilisees -->
              ${
          piecesHtml
            ? `<tr>
                <td style="padding:12px 0 0 0;">
                  <div style="font-size:13px;color:#8b92b8;padding-bottom:8px;">Pi&egrave;ces utilis&eacute;es</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1e2344;border-radius:8px;overflow:hidden;">
                    <tr>
                      <td style="padding:8px 12px;font-size:11px;color:#8b92b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #1e2344;background-color:#0a0e27;">Pi&egrave;ce</td>
                      <td style="padding:8px 12px;font-size:11px;color:#8b92b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #1e2344;background-color:#0a0e27;text-align:center;">Qt&eacute;</td>
                    </tr>
                    ${piecesHtml}
                  </table>
                </td>
              </tr>`
            : ""
        }`
      : ""
  }

              <tr>
                <td style="font-size:13px;color:#8b92b8;text-align:center;padding-top:24px;line-height:20px;">
                  Cet &eacute;quipement est de nouveau op&eacute;rationnel.
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

    const payload: ArcadeResoluPayload = await req.json();

    const html = buildHtml(payload);
    const subject = `[ALBA] Panne resolue — ${payload.numero_bt} — ${payload.equipement_code} (${payload.parc_code}) — ${formatDuree(payload.duree_minutes)}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: ["joachim.miloche@ja-fg.com", "lilimarie.pellerin@ja-fg.com"],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("[notify-arcade-incident-resolu] Resend error:", resendRes.status, errBody);
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
    console.log("[notify-arcade-incident-resolu] Email envoye:", resendData.id, "pour", payload.numero_bt);

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-arcade-incident-resolu] Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
