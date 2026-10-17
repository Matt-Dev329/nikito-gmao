import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Annonce unique : ALBA n'est plus accessible que sur nikito.tech (l'ancienne
 * adresse Bolt est fermée). Le contenu est figé et chaque adresse ne reçoit le
 * mail qu'une fois (table annonces_envoyees) : un nouvel appel ne renvoie rien
 * à ceux qui l'ont déjà reçu.
 */

const ANNONCE = "nouvelle_adresse_nikito_tech";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function corpsMail(prenom: string, estStaff: boolean): string {
  const lien = estStaff ? "https://nikito.tech/staff/login" : "https://nikito.tech";
  const connexion = estStaff
    ? "Tu te connectes comme d'habitude : choisis ton parc puis tape ton code à 6 chiffres."
    : "Tes identifiants ne changent pas : même email, même mot de passe.";
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
            ALBA a une seule adresse désormais : <strong style="color:#ffffff;">nikito.tech</strong>.<br/>
            L'ancienne adresse (<span style="color:#ffffff;">…bolt.host</span>) est fermée : elle ne reçoit plus les mises à jour et ne donne plus accès aux données.
          </td></tr>
          <tr><td align="center" style="padding:8px 0 24px 0;">
            <a href="${lien}" style="display:inline-block;background:#5DE5FF;color:#0a0e27;text-decoration:none;font-weight:700;font-size:16px;border-radius:12px;padding:14px 28px;">Ouvrir ALBA</a>
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;line-height:22px;padding-bottom:20px;">
            ${connexion}<br/><br/>
            Pense à mettre à jour ton favori ou l'icône sur l'écran d'accueil de ton téléphone / ta tablette :
            supprime l'ancienne, ouvre <a href="${lien}" style="color:#5DE5FF;">${lien.replace("https://", "")}</a> puis « Ajouter à l'écran d'accueil ».
          </td></tr>
          <tr><td style="font-size:13px;color:#8b92b8;">Si l'écran affiche une ancienne version, fais Ctrl+F5 (ou ferme et rouvre l'appli).<br/>Une question ? Ryad Neki, chef d'équipe maintenance.</td></tr>
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return repondre({ success: false, error: "Envoi de mails non configuré" }, 500);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: comptes, error } = await service
      .from("utilisateurs")
      .select("prenom, email, roles(code)")
      .eq("actif", true)
      .not("email", "is", null);
    if (error) throw error;
    const { data: deja } = await service.from("annonces_envoyees").select("email").eq("annonce", ANNONCE);
    const dejaEnvoye = new Set((deja ?? []).map((d) => d.email));

    const vus = new Set<string>();
    const aEnvoyer = (comptes ?? [])
      .map((c) => ({
        prenom: (c.prenom as string | null) ?? "",
        email: String(c.email).trim().toLowerCase(),
        estStaff: (c.roles as { code?: string } | null)?.code === "staff_operationnel",
      }))
      .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) && !dejaEnvoye.has(c.email) && !vus.has(c.email) && vus.add(c.email));

    let envoyes = 0;
    const echecs: string[] = [];
    for (let i = 0; i < aEnvoyer.length; i += 50) {
      const lot = aEnvoyer.slice(i, i + 50);
      const envoi = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(lot.map((c) => ({
          from: "ALBA by Nikito <noreply@nikito.tech>",
          to: [c.email],
          subject: "ALBA - Nouvelle adresse : nikito.tech",
          html: corpsMail(c.prenom, c.estStaff),
        }))),
      });
      if (!envoi.ok) {
        console.error("annonce-nouvelle-adresse: Resend", envoi.status, await envoi.text());
        echecs.push(...lot.map((c) => c.email));
        continue;
      }
      await service.from("annonces_envoyees").insert(lot.map((c) => ({ annonce: ANNONCE, email: c.email })));
      envoyes += lot.length;
    }
    return repondre({ success: echecs.length === 0, envoyes, deja: dejaEnvoye.size, echecs: echecs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("annonce-nouvelle-adresse:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
