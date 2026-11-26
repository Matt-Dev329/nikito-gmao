import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Envoi d'un bon d'intervention par mail au parc concerné : chef d'équipe,
 * directeur(s) et managers principaux du parc (destinataires_mise_a_jour),
 * plus la direction (Matthieu) et tous les managers du parc,
 * avec le PDF du bon en pièce jointe et les photos / vidéos en liens (7 jours).
 * Bouton « Envoyer au parc » des bons, et envoi automatique des bons d'urgence.
 *
 * Appel : POST { bon_id, pdf_base64, urgence? } avec le jeton de l'utilisateur
 * connecté ; le bon doit lui être lisible (règles de la base).
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
const texte = (t: string) => echapper(t).replace(/\n/g, "<br/>");
const dateHeure = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }) : "—";
const duree = (min: number | null) => (min === null || min === undefined ? "—" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`);

interface Urgence {
  heure_appel?: string | null;
  debut_intervention?: string | null;
  fin_intervention?: string | null;
  appelant?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const cle = Deno.env.get("RESEND_API_KEY");
    if (!cle) return repondre({ success: false, error: "RESEND_API_KEY manquante" }, 500);
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const utilisateur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const corps = await req.json().catch(() => ({}));
    const bonId = typeof corps.bon_id === "string" ? corps.bon_id : null;
    const pdf = typeof corps.pdf_base64 === "string" ? corps.pdf_base64 : null;
    const urgence = (corps.urgence ?? null) as Urgence | null;
    if (!bonId) return repondre({ success: false, error: "bon_id requis" }, 400);
    if (pdf && pdf.length > 14_000_000) return repondre({ success: false, error: "PDF trop lourd" }, 400);

    // Le bon, lu avec les droits de l'appelant (refus si non autorisé)
    const { data: bon, error: errBon } = await utilisateur
      .from("bons_intervention")
      .select("*, parc:parcs(code, nom)")
      .eq("id", bonId)
      .maybeSingle();
    if (errBon || !bon) return repondre({ success: false, error: "Bon introuvable ou non autorisé" }, 403);
    if (!bon.parc_id) return repondre({ success: false, error: "Le bon n'est rattaché à aucun parc" }, 400);

    const { data: auth } = await service.auth.getUser(jeton);
    const { data: moi } = await service
      .from("utilisateurs")
      .select("prenom, nom, email")
      .eq("auth_user_id", auth?.user?.id ?? "")
      .maybeSingle();

    const [{ data: dest }, { data: liensParc }, { data: direction }] = await Promise.all([
      service.rpc("destinataires_mise_a_jour", { p_parc: bon.parc_id }),
      service.from("parcs_utilisateurs").select("utilisateur_id").eq("parc_id", bon.parc_id),
      service.from("utilisateurs").select("email, roles!inner(code)").eq("actif", true).eq("roles.code", "direction"),
    ]);
    const idsParc = (liensParc ?? []).map((l: { utilisateur_id: string }) => l.utilisateur_id);
    const { data: managers } = idsParc.length
      ? await service.from("utilisateurs").select("email, roles!inner(code)").eq("actif", true)
        .in("id", idsParc).eq("roles.code", "manager_parc")
      : { data: [] };
    const emails = [...new Set(
      [...(dest ?? []), ...(direction ?? []), ...(managers ?? [])]
        .map((x: { email: string | null }) => x.email?.trim().toLowerCase())
        .filter(Boolean),
    )] as string[];
    if (!emails.length) return repondre({ success: false, error: "Aucun destinataire pour ce parc" }, 400);

    // Photos / vidéos : liens signés valables 7 jours
    const liens: string[] = [];
    for (const chemin of (bon.medias ?? []) as string[]) {
      const { data } = await service.storage.from("alba-bons").createSignedUrl(chemin, 7 * 24 * 3600);
      if (data?.signedUrl) liens.push(data.signedUrl);
    }

    const parc = (bon.parc as { code: string; nom: string } | null)?.nom ?? "";
    const quoi = [bon.activite, bon.equipement].filter(Boolean).join(" · ");
    const lignes: [string, string][] = [
      ["Parc", parc],
      ...(quoi ? [["Équipement", quoi] as [string, string]] : []),
      ...(urgence?.appelant ? [["Appel de", urgence.appelant] as [string, string]] : []),
      ...(urgence ? [["Heure de la panne / de l'appel", dateHeure(urgence.heure_appel)] as [string, string]] : []),
      [urgence ? "Début d'intervention" : "Date", dateHeure(urgence?.debut_intervention ?? bon.date_intervention)],
      ...(urgence ? [["Fin d'intervention", dateHeure(urgence.fin_intervention)] as [string, string]] : []),
      ["Durée", duree(bon.duree_minutes)],
      ["Technicien", bon.technicien_nom],
      ["Responsable sur place", bon.responsable_nom],
      ...(bon.test_activite === null || bon.test_activite === undefined
        ? []
        : [["Test de l'activité", bon.test_activite ? "Fait" : "Non fait"] as [string, string]]),
    ];
    const titre = `${urgence ? "🚨 Intervention d'urgence" : "Bon d'intervention"} · ${parc}${bon.numero ? ` · ${bon.numero}` : ""}`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;">
<p style="border-left:4px solid ${urgence ? "#d6336c" : "#5DE5FF"};background:#f8f9fa;padding:10px 14px;margin:0 0 16px;"><strong>${echapper(titre)}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
${lignes.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#666;white-space:nowrap;vertical-align:top;">${echapper(k)}</td><td style="padding:4px 0;">${texte(v || "—")}</td></tr>`).join("")}
</table>
${bon.probleme ? `<p style="margin-top:14px;"><strong>Problème :</strong><br/>${texte(bon.probleme)}</p>` : ""}
<p style="margin-top:14px;"><strong>Intervention :</strong><br/>${texte(bon.travaux)}</p>
${bon.pieces ? `<p><strong>Pièces utilisées :</strong><br/>${texte(bon.pieces)}</p>` : ""}
${liens.length ? `<p><strong>Photos / vidéos :</strong><br/>${liens.map((l, i) => `<a href="${echapper(l)}">Fichier ${i + 1}</a>`).join(" · ")} <span style="color:#888;font-size:12px;">(liens valables 7 jours)</span></p>` : ""}
<p style="font-size:12px;color:#888;margin-top:22px;">Bon signé en PDF ci-joint${moi ? ` · envoyé par ${echapper(`${moi.prenom} ${moi.nom}`)}` : ""} · <a href="${siteUrl}" style="color:#888;">ALBA by Nikito</a></p>
</body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: emails,
        ...(moi?.email ? { reply_to: moi.email } : {}),
        subject: `${titre}${quoi ? ` · ${quoi}` : ""}`.slice(0, 180),
        html,
        ...(pdf ? { attachments: [{ filename: `${bon.numero ?? "bon-intervention"}.pdf`, content: pdf }] } : {}),
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error("envoyer-bon-intervention: Resend", r.status, detail);
      return repondre({ success: false, error: `Envoi impossible (${r.status})` }, 502);
    }
    await service.from("bons_intervention").update({ envoye_le: new Date().toISOString() }).eq("id", bonId);
    return repondre({ success: true, envoye: emails.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("envoyer-bon-intervention:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
