import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Génère un nouveau code PIN pour un membre du staff et le lui envoie par mail.
 * Le code n'est jamais renvoyé à l'appelant : il ne transite que par le mail.
 * L'autorisation est celle de la RPC generer_pin_staff, appelée avec le jeton
 * de l'utilisateur connecté (direction, chef d'équipe, directeur / manager de parc).
 *
 * Appel : POST { utilisateur_id } avec le jeton de l'utilisateur connecté.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function corpsMail(prenom: string, pin: string, parcs: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 32px 0;">
        <span style="font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;">
          <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
        </span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:20px;">Bonjour ${echapper(prenom)},</td></tr>
          <tr><td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:20px;">
            Ton compte <strong style="color:#ffffff;">ALBA</strong> est prêt${parcs ? ` (parc : <strong style="color:#ffffff;">${echapper(parcs)}</strong>)` : ""}.
            Voici ton code personnel pour te connecter sur la tablette ou ton téléphone :
          </td></tr>
          <tr><td align="center" style="padding:8px 0 24px 0;">
            <span style="display:inline-block;background:#0a0e27;border:1px solid #5DE5FF;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:700;letter-spacing:10px;color:#5DE5FF;">${pin}</span>
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;line-height:22px;padding-bottom:24px;">
            1. Ouvre <a href="${siteUrl}/staff/login" style="color:#5DE5FF;">${siteUrl.replace(/^https?:\/\//, "")}/staff/login</a><br/>
            2. Choisis ton parc<br/>
            3. Tape ton code à 6 chiffres.
          </td></tr>
          <tr><td style="font-size:13px;color:#8b92b8;">Ne communique ce code à personne. En cas d'oubli, demande un nouveau code à ton responsable.</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Cet email a été envoyé automatiquement, ne pas répondre.</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const corps = await req.json().catch(() => ({}));
    const utilisateurId = typeof corps.utilisateur_id === "string" ? corps.utilisateur_id : null;
    if (!utilisateurId) return repondre({ success: false, error: "utilisateur_id requis" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return repondre({ success: false, error: "Envoi de mails non configuré" }, 500);
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: staff } = await service
      .from("utilisateurs")
      .select("prenom, email, actif")
      .eq("id", utilisateurId)
      .maybeSingle();
    if (!staff) return repondre({ success: false, error: "Utilisateur introuvable" }, 404);
    if (!staff.email) return repondre({ success: false, error: "Aucune adresse mail renseignée pour ce compte" }, 400);
    if (!staff.actif) return repondre({ success: false, error: "Compte désactivé" }, 400);

    // Génération avec les droits de l'appelant (la RPC vérifie rôle et parc)
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const appelant = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: pin, error: errPin } = await appelant.rpc("generer_pin_staff", { p_utilisateur_id: utilisateurId });
    if (errPin || typeof pin !== "string") return repondre({ success: false, error: errPin?.message ?? "Code non généré" }, 403);

    const { data: liens } = await service.from("parcs_utilisateurs").select("parc_id").eq("utilisateur_id", utilisateurId);
    const { data: listeParcs } = liens?.length
      ? await service.from("parcs").select("nom").in("id", liens.map((l) => l.parc_id))
      : { data: [] as { nom: string }[] };
    const parcs = (listeParcs ?? []).map((p) => p.nom).join(", ");

    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: [staff.email],
        subject: "ALBA - Ton code de connexion",
        html: corpsMail(staff.prenom ?? "", pin, parcs, siteUrl),
      }),
    });
    if (!envoi.ok) {
      console.error("envoyer-pin-staff: Resend", envoi.status, await envoi.text());
      return repondre({ success: false, error: `Envoi du mail impossible (${envoi.status})` }, 502);
    }
    return repondre({ success: true, email: staff.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("envoyer-pin-staff:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
