import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const repondre = (corps: unknown, status = 200) =>
      new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Création / mise à jour du compte d'un invité, confirmé d'office.
    // Sécurisé par le jeton d'invitation (valide, non utilisé, non expiré,
    // même email) : sans lui, impossible de toucher au mot de passe d'un compte.
    // Évite le mail de confirmation Supabase (non délivré sans SMTP dédié).
    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await req.json().catch(() => null) : null;
    if (body?.action === "compte-invitation" || body?.action === "reset-for-invitation") {
      const token = typeof body.token === "string" ? body.token : "";
      const motDePasse = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!token || motDePasse.length < 6) return repondre({ error: "Jeton d'invitation et mot de passe (6 caractères min.) requis" }, 400);

      const { data: invitation } = await supabase
        .from("invitations")
        .select("email, auth_mode, expire_le, utilise_le")
        .eq("token", token)
        .maybeSingle();
      if (
        !invitation?.email ||
        invitation.auth_mode !== "email_password" ||
        invitation.utilise_le ||
        new Date(invitation.expire_le).getTime() < Date.now()
      ) {
        return repondre({ error: "Invitation invalide ou expirée" }, 403);
      }
      if (body.email && String(body.email).toLowerCase() !== invitation.email.toLowerCase()) {
        return repondre({ error: "Invitation invalide" }, 403);
      }

      const metadonnees = {
        ...(typeof body.prenom === "string" ? { prenom: body.prenom.trim() } : {}),
        ...(typeof body.nom === "string" ? { nom: body.nom.trim() } : {}),
        password_must_change: false,
      };

      // Compte déjà créé (inscription non confirmée, ou pré-provisionné) ?
      let existant: { id: string; user_metadata?: Record<string, unknown> } | undefined;
      for (let page = 1; page <= 20 && !existant; page++) {
        const { data: liste } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        existant = liste?.users?.find((u) => u.email?.toLowerCase() === invitation.email.toLowerCase());
        if (!liste?.users?.length || liste.users.length < 200) break;
      }

      if (existant) {
        const { error } = await supabase.auth.admin.updateUserById(existant.id, {
          password: motDePasse,
          email_confirm: true,
          user_metadata: { ...existant.user_metadata, ...metadonnees },
        });
        if (error) return repondre({ error: error.message }, 500);
        return repondre({ success: true, auth_user_id: existant.id });
      }

      const { data: cree, error } = await supabase.auth.admin.createUser({
        email: invitation.email,
        password: motDePasse,
        email_confirm: true,
        user_metadata: metadonnees,
      });
      if (error || !cree?.user) return repondre({ error: error?.message ?? "Création impossible" }, 500);
      return repondre({ success: true, auth_user_id: cree.user.id });
    }

    // Provisionnement en masse : réservé à la direction / admin IT
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: appelantAuth } = await supabase.auth.getUser(jeton);
    const { data: appelant } = appelantAuth?.user
      ? await supabase.from("utilisateurs").select("roles(code)").eq("auth_user_id", appelantAuth.user.id).maybeSingle()
      : { data: null };
    const roleAppelant = (appelant?.roles as { code?: string } | null)?.code ?? "";
    if (!["direction", "admin_it"].includes(roleAppelant)) return repondre({ error: "Accès refusé" }, 403);

    // Find all email_password users without auth_user_id
    const { data: orphans, error: queryErr } = await supabase
      .from("utilisateurs")
      .select("id, prenom, nom, email")
      .is("auth_user_id", null)
      .eq("auth_mode", "email_password")
      .eq("actif", true)
      .not("email", "is", null);

    if (queryErr) {
      return new Response(
        JSON.stringify({ error: queryErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!orphans || orphans.length === 0) {
      return new Response(
        JSON.stringify({ message: "No orphan users found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      email: string;
      prenom: string;
      status: string;
      auth_user_id?: string;
    }> = [];

    for (const user of orphans) {
      if (!user.email) continue;

      // Create auth account with random password + force password change
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { password_must_change: true },
      });

      let authUserId: string | null = null;

      if (authErr) {
        if (authErr.message?.includes("already been registered") || authErr.message?.includes("already exists")) {
          // User already exists in auth - find their ID
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u) => u.email?.toLowerCase() === user.email.toLowerCase()
          );
          if (existing) {
            authUserId = existing.id;
          } else {
            results.push({ email: user.email, prenom: user.prenom, status: `AUTH_EXISTS_BUT_NOT_FOUND` });
            continue;
          }
        } else {
          results.push({ email: user.email, prenom: user.prenom, status: `AUTH_CREATE_ERROR: ${authErr.message}` });
          continue;
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
      }

      if (!authUserId) {
        results.push({ email: user.email, prenom: user.prenom, status: "NO_AUTH_ID" });
        continue;
      }

      // Link auth_user_id to utilisateurs
      const { error: updateErr } = await supabase
        .from("utilisateurs")
        .update({ auth_user_id: authUserId })
        .eq("id", user.id);

      if (updateErr) {
        results.push({ email: user.email, prenom: user.prenom, status: `LINK_ERROR: ${updateErr.message}`, auth_user_id: authUserId });
        continue;
      }

      // Send password reset email via Supabase
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: user.email,
        options: { redirectTo: `${siteUrl}/reset-password` },
      });

      // Send welcome email via Resend
      if (resendApiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ALBA by Nikito <noreply@nikito.tech>",
            to: [user.email],
            subject: "ALBA - Definissez votre mot de passe",
            html: buildWelcomeHtml(user.prenom, siteUrl),
          }),
        });
        await new Promise((r) => setTimeout(r, 150));
      }

      results.push({ email: user.email, prenom: user.prenom, status: "OK", auth_user_id: authUserId });
    }

    const successCount = results.filter((r) => r.status === "OK").length;

    return new Response(
      JSON.stringify({
        success: true,
        total_orphans: orphans.length,
        provisioned: successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provision-auth-accounts] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function buildWelcomeHtml(prenom: string, siteUrl: string): string {
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
          <tr><td style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:20px;">
            Bonjour ${prenom},
          </td></tr>
          <tr><td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:20px;">
            Votre compte <strong style="color:#ffffff;">ALBA</strong> est maintenant actif.
            Pour vous connecter, vous devez d'abord d&eacute;finir votre mot de passe.
          </td></tr>
          <tr><td style="font-size:15px;color:#8b92b8;line-height:24px;padding-bottom:24px;">
            Cliquez sur le bouton ci-dessous pour acc&eacute;der &agrave; la page de connexion, puis utilisez "Mot de passe oubli&eacute;" avec votre adresse email pour recevoir le lien de cr&eacute;ation.
          </td></tr>
          <tr><td align="center" style="padding:0 0 24px 0;">
            <a href="${siteUrl}" style="display:inline-block;background:linear-gradient(135deg,#5DE5FF 0%,#e91e8c 100%);color:#0a0e27;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;">
              Acceder a ALBA
            </a>
          </td></tr>
          <tr><td style="background:#e0f2fe;border-left:4px solid #0ea5e9;padding:12px 16px;border-radius:6px;font-size:13px;color:#0c4a6e;">
            <strong>Etape 1 :</strong> Cliquez sur "Mot de passe oubli&eacute;" sur la page de connexion.<br/>
            <strong>Etape 2 :</strong> Entrez votre email professionnel.<br/>
            <strong>Etape 3 :</strong> Suivez le lien re&ccedil;u par email pour cr&eacute;er votre mot de passe.
          </td></tr>
          <tr><td style="font-size:14px;color:#8b92b8;padding-top:20px;">
            En cas de probl&egrave;me, contactez votre manager ou l'&eacute;quipe IT.
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 0 0 0;text-align:center;">
        <div style="font-size:11px;color:#8b92b8;line-height:20px;">Cet email a &eacute;t&eacute; envoy&eacute; automatiquement, ne pas r&eacute;pondre.</div>
        <div style="font-size:10px;color:#6E6E96;padding-top:16px;">&copy; Nikito Group &middot; ALBA</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
