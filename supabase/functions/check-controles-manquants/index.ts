import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nikito.tech",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParcManquant {
  id: string;
  code: string;
  nom: string;
}

function buildHtml(parcsManquants: ParcManquant[], date: string): string {
  const lignesHtml = parcsManquants
    .map(
      (p) =>
        `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #1a1f4e;font-size:14px;color:#5DE5FF;font-weight:600;">${p.code}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1a1f4e;font-size:14px;color:#ffffff;">${p.nom}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1a1f4e;font-size:14px;color:#FF4D6D;font-weight:600;text-align:center;">Non fait</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alerte contr&ocirc;les manquants</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <tr>
          <td align="center" style="padding:0 0 32px 0;">
            <span style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span></span>
          </td>
        </tr>

        <tr>
          <td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="padding-bottom:8px;">
                  <span style="display:inline-block;background-color:#FF4D6D;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:6px;">Alerte</span>
                </td>
              </tr>

              <tr>
                <td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:6px;">
                  Contr&ocirc;les d'ouverture manquants
                </td>
              </tr>

              <tr>
                <td style="font-size:13px;color:#8b92b8;padding-bottom:24px;">
                  Date : <strong style="color:#ffffff;">${date}</strong> &mdash; ${parcsManquants.length} parc${parcsManquants.length > 1 ? "s" : ""} concern&eacute;${parcsManquants.length > 1 ? "s" : ""}
                </td>
              </tr>

              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;">
                    <thead>
                      <tr style="background-color:#0a0e27;">
                        <th style="padding:10px 14px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Code</th>
                        <th style="padding:10px 14px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Parc</th>
                        <th style="padding:10px 14px;font-size:10px;color:#8b92b8;text-transform:uppercase;letter-spacing:1px;text-align:center;font-weight:600;">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lignesHtml}
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:24px;text-align:center;">
                  <a href="https://alba.nikito.tech/gmao" style="display:inline-block;background-color:#5DE5FF;color:#0B0B2E;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Ouvrir ALBA</a>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:10px;color:#6E6E96;text-align:center;">
                  &copy; Nikito Group &middot; GMAO &middot; Notification automatique
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().slice(0, 10);

    const [parcsRes, ctrlRes] = await Promise.all([
      supabase.from("parcs").select("id, code, nom").eq("actif", true),
      supabase
        .from("controles")
        .select("parc_id")
        .eq("type", "quotidien")
        .eq("date_planifiee", today)
        .eq("statut", "valide"),
    ]);

    if (parcsRes.error) throw parcsRes.error;
    if (ctrlRes.error) throw ctrlRes.error;

    const parcsAvecControle = new Set(
      (ctrlRes.data ?? []).map((c: { parc_id: string }) => c.parc_id),
    );

    const parcsManquants: ParcManquant[] = (parcsRes.data ?? [])
      .filter((p: { id: string }) => !parcsAvecControle.has(p.id))
      .map((p: { id: string; code: string; nom: string }) => ({
        id: p.id,
        code: p.code,
        nom: p.nom,
      }));

    if (parcsManquants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Tous les controles sont faits", parcs_manquants: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: destinataires, error: errDest } = await supabase
      .from("utilisateurs")
      .select("email, roles!inner(code)")
      .eq("actif", true)
      .in("roles.code", ["direction", "chef_maintenance"]);

    if (errDest) throw errDest;

    const emails = (destinataires ?? [])
      .map((d: { email: string }) => d.email)
      .filter((e: string) => e && e.includes("@"));

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun destinataire trouve", parcs_manquants: parcsManquants.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dateFr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = buildHtml(parcsManquants, dateFr);

    const subject = `[ALERTE] ${parcsManquants.length} controle${parcsManquants.length > 1 ? "s" : ""} d'ouverture manquant${parcsManquants.length > 1 ? "s" : ""} - ${dateFr}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: emails,
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
      JSON.stringify({
        success: true,
        resend_id: resendData.id,
        parcs_manquants: parcsManquants.length,
        destinataires: emails.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-controles-manquants error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
