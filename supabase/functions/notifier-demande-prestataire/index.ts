import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Appelée par le trigger de demandes_prestataires (pg_net) à chaque nouvelle
// demande (spécifique ou d'intervention) : email au chef d'équipe (sauf s'il
// est l'auteur de la demande). La notification appli part du trigger.
// Idempotente : un email par demande (colonne email_envoye_le).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = "https://nikito.tech";

const TYPES: Record<string, string> = {
  intervention: "Demande d'intervention",
  specifique: "Demande spécifique",
};

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

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

function ligne(label: string, valeur: string | null | undefined): string {
  if (!valeur) return "";
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-size:12px;color:#8b92b8;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#ffffff;">${esc(valeur)}</td>
  </tr>`;
}

function buildHtml(p: {
  type: string;
  urgente: boolean;
  objet: string;
  description: string | null;
  parc: string;
  auteur: string;
  prestataire: string | null;
  domaine: string | null;
  dateSouhaitee: string | null;
  pieceNom: string | null;
}): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(TYPES[p.type] ?? "Demande prestataire")}</title></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding:0 0 32px 0;font-size:24px;font-weight:700;letter-spacing:4px;color:#ffffff;">
        <span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:14px;font-weight:400;">by Nikito</span>
      </td></tr>
      <tr><td style="background-color:#131836;border-radius:16px;padding:36px 32px;">
        <div style="font-size:13px;color:#5DE5FF;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">
          ${esc(TYPES[p.type] ?? "Demande prestataire")}${p.urgente ? ` · <span style="color:#FF4D6D;">Urgent</span>` : ""}
        </div>
        <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:6px;">${esc(p.objet)}</div>
        <div style="font-size:13px;color:#8b92b8;padding-bottom:20px;">${esc(p.parc)} · par ${esc(p.auteur)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          ${ligne("Prestataire", p.prestataire)}
          ${ligne("Domaine", p.domaine)}
          ${ligne("Souhaitée pour le", p.dateSouhaitee ? dateFr(p.dateSouhaitee) : null)}
          ${ligne("Pièce jointe", p.pieceNom)}
        </table>
        ${p.description ? `<div style="font-size:14px;color:#c8c8e0;line-height:21px;padding-top:16px;">${esc(p.description).replace(/\n/g, "<br>")}</div>` : ""}
        <div style="padding-top:28px;text-align:center;">
          <a href="${APP_URL}/gmao/demandes-prestataires" style="display:inline-block;background:#5DE5FF;color:#0a0e27;font-weight:700;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:999px;">Voir la demande</a>
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

  // Demande dont l'envoi a été réservé : libérée si une erreur survient ensuite
  let reserveeId: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ success: false, error: "RESEND_API_KEY non configuree" }, 500);

    const { demande_id } = await req.json();
    if (!demande_id) return json({ success: false, error: "demande_id manquant" }, 400);

    // Réserve l'envoi : ne passe qu'une fois par demande
    const { data: demande } = await supabase
      .from("demandes_prestataires")
      .update({ email_envoye_le: new Date().toISOString() })
      .eq("id", demande_id)
      .is("email_envoye_le", null)
      .select("id, parc_id, type, prestataire, domaine, objet, description, urgente, date_souhaitee, piece_nom, cree_par_id")
      .maybeSingle();
    if (!demande) return json({ success: true, skipped: "deja_envoye_ou_introuvable" });
    reserveeId = demande.id;

    const [{ data: auteur }, { data: parc }, { data: chefs }] = await Promise.all([
      demande.cree_par_id
        ? supabase.from("utilisateurs").select("prenom, nom, email").eq("id", demande.cree_par_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("parcs").select("code, nom").eq("id", demande.parc_id).maybeSingle(),
      supabase.from("utilisateurs").select("id, email, roles!inner(code)").eq("actif", true).eq("roles.code", "chef_maintenance"),
    ]);

    const destinataires = [
      ...new Set(
        (chefs ?? [])
          .filter((c) => c.id !== demande.cree_par_id)
          .map((c) => c.email as string | null)
          .filter((e): e is string => !!e),
      ),
    ];
    if (destinataires.length === 0) return json({ success: true, skipped: "aucun_destinataire" });

    const auteurNom = auteur ? `${auteur.prenom} ${auteur.nom}` : "—";
    const parcNom = parc ? `${parc.code} · ${parc.nom}` : "—";
    const typeLibelle = TYPES[demande.type] ?? "Demande prestataire";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: destinataires,
        reply_to: auteur?.email ?? undefined,
        subject: `[GMAO - ${typeLibelle}]${demande.urgente ? " URGENT ·" : ""} ${demande.objet} · ${parc?.code ?? ""} · ${auteurNom}`,
        html: buildHtml({
          type: demande.type,
          urgente: !!demande.urgente,
          objet: demande.objet,
          description: demande.description,
          parc: parcNom,
          auteur: auteurNom,
          prestataire: demande.prestataire,
          domaine: demande.domaine,
          dateSouhaitee: demande.date_souhaitee,
          pieceNom: demande.piece_nom,
        }),
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("Resend error:", resendRes.status, detail);
      await supabase.from("demandes_prestataires").update({ email_envoye_le: null }).eq("id", demande.id);
      reserveeId = null;
      return json({ success: false, error: "Echec envoi email", detail }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("notifier-demande-prestataire error:", err);
    if (reserveeId) {
      await supabase.from("demandes_prestataires").update({ email_envoye_le: null }).eq("id", reserveeId);
    }
    return json({ success: false, error: "Erreur interne", detail: String(err) }, 500);
  }
});
