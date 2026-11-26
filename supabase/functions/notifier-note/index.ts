import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Bandeau Nikito Maintenance en tête de chaque mail ALBA : ajouté au HTML de
// tout envoi Resend de cette fonction (même bloc dans toutes les fonctions).
const BANDEAU_ALBA =
  '<table role="presentation" data-alba-bandeau="1" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0B26;"><tr><td align="center" style="padding:0;">' +
  '<img src="https://nikito.tech/email-bandeau.jpg" width="600" alt="Nikito Maintenance" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />' +
  "</td></tr></table>";
const avecBandeauAlba = (html: unknown) =>
  typeof html !== "string" || html.includes("data-alba-bandeau")
    ? html
    : /<body[^>]*>/i.test(html)
      ? html.replace(/<body[^>]*>/i, (b) => b + BANDEAU_ALBA)
      : BANDEAU_ALBA + html;
const fetchSansBandeau = globalThis.fetch;
globalThis.fetch = (entree: Request | URL | string, init?: RequestInit) => {
  try {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    if (url.startsWith("https://api.resend.com/emails") && typeof init?.body === "string") {
      const corps = JSON.parse(init.body);
      const maj = (m: { html?: unknown }) => (m && typeof m === "object" ? { ...m, html: avecBandeauAlba(m.html) } : m);
      init = { ...init, body: JSON.stringify(Array.isArray(corps) ? corps.map(maj) : maj(corps)) };
    }
  } catch {
    // corps non JSON : envoyé tel quel
  }
  return fetchSansBandeau(entree, init);
};

/**
 * Mail à chaque note ajoutée sur un ticket ou une commande, au chef d'équipe,
 * à la direction et aux directeurs du parc concerné (hors auteur de la note).
 * Appelée par le trigger trg_notifier_note_mail (pg_net) avec { id }.
 * Un seul mail par note (colonne mail_envoye_le), quel que soit le nombre d'appels.
 */

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const texte = (t: string) => echapper(t).replace(/\n/g, "<br/>");
const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

interface ContenuMail {
  emails: string[];
  objet: string;
  lien: string;
  parc: string | null;
  auteur: string | null;
  texte: string;
  cree_le: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return repondre({ success: false }, 405);
  try {
    const corps = await req.json().catch(() => ({}));
    const id = typeof corps.id === "string" ? corps.id : null;
    if (!id) return repondre({ success: false, error: "id manquant" }, 400);
    const cle = Deno.env.get("RESEND_API_KEY");
    if (!cle) return repondre({ success: false, error: "RESEND_API_KEY manquante" }, 500);
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Réserve l'envoi (une seule fois par note)
    const { data: pris } = await service
      .from("notes_partagees")
      .update({ mail_envoye_le: new Date().toISOString() })
      .eq("id", id)
      .is("mail_envoye_le", null)
      .select("id");
    if (!pris?.length) return repondre({ success: true, envoye: 0 });

    const { data, error } = await service.rpc("mail_note_partagee", { p_note_id: id });
    if (error) {
      await service.from("notes_partagees").update({ mail_envoye_le: null }).eq("id", id);
      throw error;
    }
    const m = data as ContenuMail | null;
    const emails = [...new Set(m?.emails ?? [])].filter(Boolean);
    if (!m || !emails.length) return repondre({ success: true, envoye: 0 });

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;">
<p style="border-left:4px solid #5DE5FF;background:#f8f9fa;padding:10px 14px;margin:0 0 16px;">
<strong>📝 Nouvelle note${m.parc ? ` · ${echapper(m.parc)}` : ""}</strong><br/>${echapper(m.objet)}
</p>
<p style="margin:0 0 6px;color:#666;">${echapper(m.auteur ?? "—")} · ${dateHeure(m.cree_le)}</p>
<div style="border:1px solid #e9ecef;border-radius:8px;padding:12px 14px;">${texte(m.texte)}</div>
<p style="margin-top:18px;"><a href="${siteUrl}${m.lien}" style="display:inline-block;background:#5DE5FF;color:#0B0B2E;font-weight:700;text-decoration:none;padding:10px 22px;border-radius:8px;">Ouvrir dans ALBA</a></p>
<p style="font-size:12px;color:#888;margin-top:24px;">Pour répondre, ajoute une note directement dans ALBA.</p>
</body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: emails,
        subject: `📝 Note · ${m.objet}${m.parc ? ` · ${m.parc}` : ""}`.slice(0, 180),
        html,
      }),
    });
    if (!r.ok) {
      console.error("notifier-note: Resend", r.status, await r.text());
      // Échec : on libère pour un nouvel essai
      await service.from("notes_partagees").update({ mail_envoye_le: null }).eq("id", id);
      return repondre({ success: false, error: `Envoi impossible (${r.status})` }, 502);
    }
    return repondre({ success: true, envoye: emails.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("notifier-note:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
