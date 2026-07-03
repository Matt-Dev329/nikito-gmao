import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildHtml(prenom: string, parcNom: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Controle hebdomadaire obligatoire</title></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 32px 0;">
        <span style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span></span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-bottom:8px;">
            <span style="display:inline-block;background-color:#FFB400;color:#0B0B2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:6px;">Obligation</span>
          </td></tr>
          <tr><td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:12px;">Bonjour ${prenom},</td></tr>
          <tr><td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:18px;">
            En tant que <strong style="color:#ffffff;">manager du parc ${parcNom}</strong>, la r&eacute;alisation du <strong style="color:#ffffff;">contr&ocirc;le hebdomadaire</strong> fait partie de vos obligations.
            Ce contr&ocirc;le doit &ecirc;tre effectu&eacute; <strong style="color:#ffffff;">chaque semaine</strong> (il est g&eacute;n&eacute;r&eacute; automatiquement chaque mardi).
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;line-height:24px;padding-bottom:24px;">
            Connectez-vous &agrave; ALBA, puis ouvrez <strong style="color:#ffffff;">Contr&ocirc;les &rarr; Contr&ocirc;le hebdo</strong> pour le r&eacute;aliser.
          </td></tr>
          <tr><td align="center" style="padding:0 0 8px 0;">
            <a href="https://nikito.tech/staff/controle-hebdo" style="display:inline-block;background-color:#5DE5FF;color:#0B0B2E;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Faire le controle hebdo</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 0 0 0;text-align:center;">
        <div style="font-size:10px;color:#6E6E96;">&copy; Nikito Group &middot; GMAO &middot; Notification automatique</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY non configuree" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let parcCode = "FRA";
    try {
      const body = await req.json();
      if (body?.parc_code) parcCode = String(body.parc_code);
    } catch { /* pas de body : defaut FRA */ }

    const { data: parc, error: parcErr } = await supabase
      .from("parcs").select("id, code, nom").eq("code", parcCode).maybeSingle();
    if (parcErr) throw parcErr;
    if (!parc) {
      return new Response(JSON.stringify({ success: false, error: `Parc ${parcCode} introuvable` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: liens, error: liensErr } = await supabase
      .from("parcs_utilisateurs").select("utilisateur_id").eq("parc_id", parc.id);
    if (liensErr) throw liensErr;
    const ids = (liens ?? []).map((l: { utilisateur_id: string }) => l.utilisateur_id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Aucun utilisateur pour ce parc", envoyes: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: managers, error: mgrErr } = await supabase
      .from("utilisateurs")
      .select("email, prenom, roles!inner(code)")
      .in("id", ids)
      .eq("actif", true)
      .eq("roles.code", "manager_parc");
    if (mgrErr) throw mgrErr;

    const destinataires = (managers ?? [])
      .filter((m: { email: string | null }) => m.email && m.email.includes("@"));

    let envoyes = 0;
    for (const m of destinataires) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ALBA by Nikito <noreply@nikito.tech>",
          to: [m.email],
          subject: `[ALBA] Obligation - Controle hebdomadaire (${parc.nom})`,
          html: buildHtml(m.prenom ?? "", parc.nom),
        }),
      });
      if (res.ok) envoyes++;
      await new Promise((r) => setTimeout(r, 120));
    }

    return new Response(
      JSON.stringify({ success: true, parc: parc.code, destinataires: destinataires.length, envoyes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("rappel-controle-hebdo error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
