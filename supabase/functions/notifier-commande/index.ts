import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Appelée par la RPC passer_commande (pg_net) : envoie un email récapitulatif
// de la commande à chaque chef d'équipe actif. Commande directe (activités
// « sans validation », ex. Arcade) : envoyée aux destinataires de l'activité,
// chefs d'équipe en copie, avec une notification appli. Idempotente : un email
// par commande (colonne commandes.email_envoye_le).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = "https://nikito.tech";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function euros(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toFixed(2).replace(".", ",")} €`;
}

interface Ligne {
  activite_nom: string | null;
  produit_nom: string;
  reference: string | null;
  unite: string;
  quantite: number;
  prix_unitaire: number | null;
  lien: string | null;
}

function buildHtml(p: {
  numero: string;
  demandeur: string;
  parc: string;
  commentaire: string | null;
  total: number | null;
  lignes: Ligne[];
  directe: boolean;
}): string {
  const rows = p.lignes
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;border-bottom:1px solid #1f2550;">
          ${esc(l.produit_nom)}${l.reference ? ` <span style="color:#8b92b8;font-size:12px;">· ${esc(l.reference)}</span>` : ""}
          ${l.activite_nom ? `<div style="font-size:11px;color:#8b92b8;">${esc(l.activite_nom)}</div>` : ""}
          ${l.lien && /^https?:\/\//i.test(l.lien) ? `<div style="font-size:11px;"><a href="${esc(l.lien)}" style="color:#5DE5FF;">Voir l'article</a></div>` : ""}
        </td>
        <td style="padding:8px 0;font-size:14px;color:#ffffff;text-align:right;border-bottom:1px solid #1f2550;white-space:nowrap;">
          ${l.quantite} ${esc(l.unite)}
        </td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Nouvelle commande ${esc(p.numero)}</title></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 32px 0;font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;">
        <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:6px;">${p.directe ? "Commande à préparer" : "Nouvelle demande de commande"}</div>
        ${p.directe ? `<div style="font-size:13px;color:#FFB547;padding-bottom:10px;">Commande directe, sans validation : à préparer et livrer au parc.</div>` : ""}
        <div style="font-size:13px;color:#8b92b8;padding-bottom:20px;">
          <strong style="color:#5DE5FF;">${esc(p.numero)}</strong> · ${esc(p.parc)} · par ${esc(p.demandeur)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        <div style="font-size:14px;color:#ffffff;text-align:right;padding-top:12px;">
          Total estimé : <strong>${euros(p.total)}</strong>
        </div>
        ${p.commentaire ? `<div style="font-size:13px;color:#c8c8e0;line-height:20px;padding-top:16px;"><span style="color:#5DE5FF;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Commentaire</span><br>${esc(p.commentaire).replace(/\n/g, "<br>")}</div>` : ""}
        <div style="padding-top:28px;text-align:center;">
          <a href="${APP_URL}/gmao/commander" style="display:inline-block;background:#5DE5FF;color:#0a0e27;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:999px;">Voir la commande</a>
        </div>
      </td></tr>
      <tr><td style="font-size:10px;color:#6E6E96;text-align:center;padding-top:28px;">&copy; Nikito Group &middot; GMAO</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Commande dont l'envoi a été réservé : libérée si une erreur survient ensuite
  let reserveeId: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ success: false, error: "RESEND_API_KEY non configuree" }, 500);

    const { commande_id } = await req.json();
    if (!commande_id) return json({ success: false, error: "commande_id manquant" }, 400);

    // Réserve l'envoi : ne passe qu'une fois par commande
    const { data: commande } = await supabase
      .from("commandes")
      .update({ email_envoye_le: new Date().toISOString() })
      .eq("id", commande_id)
      .is("email_envoye_le", null)
      .select("id, numero, commentaire, total_estime, demandeur_id, parc_id, directe")
      .maybeSingle();
    if (!commande) return json({ success: true, skipped: "deja_envoye_ou_introuvable" });
    reserveeId = commande.id;

    const [{ data: lignes }, { data: demandeur }, { data: parc }, { data: gestionnaires }] = await Promise.all([
      supabase
        .from("commande_lignes")
        .select("activite_id, activite_nom, produit_nom, reference, unite, quantite, prix_unitaire, lien")
        .eq("commande_id", commande.id),
      supabase.from("utilisateurs").select("prenom, nom, email").eq("id", commande.demandeur_id).maybeSingle(),
      supabase.from("parcs").select("nom").eq("id", commande.parc_id).maybeSingle(),
      // Destinataires : les chefs d'équipe actifs (rôle chef_maintenance)
      supabase.from("utilisateurs").select("email, roles!inner(code)").eq("actif", true).eq("roles.code", "chef_maintenance"),
    ]);

    const chefs = (gestionnaires ?? [])
      .map((g) => g.email as string | null)
      .filter((e): e is string => !!e);

    // Commande directe : destinataires désignés sur les activités commandées
    let directs: { id: string; email: string | null }[] = [];
    if (commande.directe) {
      const activiteIds = [...new Set((lignes ?? []).map((l) => l.activite_id as string | null).filter(Boolean))] as string[];
      const { data: activites } = activiteIds.length
        ? await supabase.from("commande_activites").select("destinataire_ids").in("id", activiteIds)
        : { data: [] };
      const ids = [...new Set((activites ?? []).flatMap((a) => (a.destinataire_ids as string[] | null) ?? []))];
      if (ids.length) {
        const { data } = await supabase.from("utilisateurs").select("id, email").in("id", ids).eq("actif", true);
        directs = (data ?? []) as { id: string; email: string | null }[];
      }
    }
    const emailsDirects = [...new Set(directs.map((u) => u.email).filter((e): e is string => !!e))];
    const destinataires = emailsDirects.length ? emailsDirects : chefs;
    const copie = emailsDirects.length ? chefs.filter((e) => !emailsDirects.includes(e)) : [];
    if (destinataires.length === 0) return json({ success: true, skipped: "aucun_destinataire" });

    const demandeurNom = demandeur ? `${demandeur.prenom} ${demandeur.nom}` : "—";
    const html = buildHtml({
      numero: commande.numero,
      demandeur: demandeurNom,
      parc: parc?.nom ?? "—",
      commentaire: commande.commentaire,
      total: commande.total_estime,
      lignes: (lignes ?? []) as Ligne[],
      directe: !!commande.directe,
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: destinataires,
        ...(copie.length ? { cc: copie } : {}),
        reply_to: demandeur?.email ?? undefined,
        subject: `[GMAO - Commande${commande.directe ? " à préparer" : ""}] ${commande.numero} · ${parc?.nom ?? ""} · ${demandeurNom}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("Resend error:", resendRes.status, detail);
      // Libère la réservation pour permettre un nouvel essai
      await supabase.from("commandes").update({ email_envoye_le: null }).eq("id", commande.id);
      reserveeId = null;
      return json({ success: false, error: "Echec envoi email", detail }, 502);
    }

    // Notification appli aux destinataires d'une commande directe
    for (const u of directs) {
      await supabase.rpc("notifier_push", {
        p_utilisateur_id: u.id,
        p_titre: `Commande à préparer · ${commande.numero}`,
        p_corps: `${parc?.nom ?? ""} · ${(lignes ?? []).length} article${(lignes ?? []).length > 1 ? "s" : ""}`,
        p_url: "/gmao/commander",
      });
    }

    return json({ success: true });
  } catch (err) {
    console.error("notifier-commande error:", err);
    if (reserveeId) {
      await supabase.from("commandes").update({ email_envoye_le: null }).eq("id", reserveeId);
    }
    return json({ success: false, error: "Erreur interne", detail: String(err) }, 500);
  }
});
