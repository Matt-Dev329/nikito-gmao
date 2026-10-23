import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Alerte de fin de contrat prestataire : mail (et notification appli) 60 puis
 * 30 jours avant la date de fin, au chef d'équipe et aux directeurs du parc.
 * Appelé chaque jour par pg_cron (gmao_alertes_fin_contrats) ; un seul envoi
 * par contrat et par palier (alertes_contrats_envoyees).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (t: string | null | undefined) =>
  (t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const dateFr = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR");
const PALIERS = [60, 30];

type Contrat = {
  id: string;
  titre: string;
  prestataire: string | null;
  activite: string | null;
  parc_id: string | null;
  prochaine_echeance: string | null;
  parc: { code: string; nom: string } | null;
  analyse:
    | { resume: string | null; date_fin: string | null; preavis: string | null; date_limite_resiliation: string | null; reconduction: string | null; montant: string | null }
    | { resume: string | null; date_fin: string | null; preavis: string | null; date_limite_resiliation: string | null; reconduction: string | null; montant: string | null }[]
    | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!resendApiKey) throw new Error("RESEND_API_KEY manquante");
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";

    // Date du jour à Paris
    const aujourdhui = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    aujourdhui.setHours(12, 0, 0, 0);

    const { data, error } = await service
      .from("documents_techniques")
      .select(
        "id, titre, prestataire, activite, parc_id, prochaine_echeance, parc:parcs(code, nom), analyse:analyses_contrats(resume, date_fin, preavis, date_limite_resiliation, reconduction, montant)",
      )
      .eq("type", "contrat")
      .eq("actif", true);
    if (error) throw error;

    const [{ data: equipe }, { data: liens }] = await Promise.all([
      service.from("utilisateurs").select("id, email, roles!inner(code)").eq("actif", true).in("roles.code", ["chef_maintenance", "directeur_parc"]),
      service.from("parcs_utilisateurs").select("utilisateur_id, parc_id"),
    ]);
    const membres = (equipe ?? []) as unknown as { id: string; email: string | null; roles: { code: string } }[];
    const parcsDe = new Map<string, Set<string>>();
    ((liens ?? []) as { utilisateur_id: string; parc_id: string }[]).forEach((l) => {
      if (!parcsDe.has(l.utilisateur_id)) parcsDe.set(l.utilisateur_id, new Set());
      parcsDe.get(l.utilisateur_id)!.add(l.parc_id);
    });

    let envoyes = 0;
    for (const c of (data ?? []) as unknown as Contrat[]) {
      const a = Array.isArray(c.analyse) ? c.analyse[0] ?? null : c.analyse;
      const fin = c.prochaine_echeance ?? a?.date_fin ?? null;
      if (!fin) continue;
      const jours = Math.round((new Date(`${fin}T12:00:00`).getTime() - aujourdhui.getTime()) / 86_400_000);
      // Palier atteint le plus proche (30 si moins de 30 jours, sinon 60) : un contrat
      // déposé tard ou un jour sans cron reçoit quand même son alerte
      const palier = [...PALIERS].sort((x, y) => x - y).find((p) => jours >= 0 && jours <= p);
      if (!palier) continue;

      const { error: deja } = await service.from("alertes_contrats_envoyees").insert({ document_id: c.id, palier });
      if (deja) continue;

      const destinataires = membres.filter(
        (u) => u.roles.code === "chef_maintenance" || !c.parc_id || parcsDe.get(u.id)?.has(c.parc_id),
      );
      const emails = [...new Set(destinataires.map((u) => u.email).filter((e): e is string => !!e))];
      const parc = c.parc ? `${c.parc.code} · ${c.parc.nom}` : "Tous les parcs";
      const titre = `Fin de contrat dans ${jours} jours · ${c.titre}${c.parc ? ` · ${c.parc.code}` : ""}`;
      const lignes: [string, string | null][] = [
        ["Parc", parc],
        ["Prestataire", c.prestataire],
        ["Domaine", c.activite],
        ["Fin du contrat", dateFr(fin)],
        ["Reconduction", a?.reconduction ?? null],
        ["Préavis", a?.preavis ?? null],
        ["Résilier avant le", a?.date_limite_resiliation ? dateFr(a.date_limite_resiliation) : null],
        ["Prix", a?.montant ?? null],
      ];
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0e27;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0e27;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding:0 0 20px 0;"><span style="font-size:22px;font-weight:700;letter-spacing:4px;color:#ffffff;"><span style="color:#5DE5FF;">A</span>LBA <span style="color:#8b92b8;font-size:13px;font-weight:400;">by Nikito</span></span></td></tr>
  <tr><td style="background-color:#131836;border-radius:14px;padding:22px;border-left:4px solid ${jours <= 30 ? "#FF4D6D" : "#FFB547"};">
    <div style="font-size:18px;color:#ffffff;font-weight:600;padding-bottom:4px;">Ce contrat se termine dans ${jours} jours</div>
    <div style="font-size:15px;color:#5DE5FF;padding-bottom:14px;">${esc(c.titre)}</div>
    ${a?.resume ? `<div style="font-size:13px;color:#d6d9ec;line-height:1.5;padding-bottom:14px;">${esc(a.resume)}</div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;">
      ${lignes.filter(([, v]) => v).map(([l, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#8b92b8;white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:3px 0;color:#ffffff;">${esc(v)}</td></tr>`).join("")}
    </table>
    <div style="font-size:13px;color:#FFB547;padding-top:14px;">À décider maintenant : renouveler, renégocier ou résilier${a?.preavis ? " (attention au préavis)" : ""}.</div>
    <div style="padding-top:16px;"><a href="${siteUrl}/gmao/contrats" style="display:inline-block;background:#5DE5FF;color:#0a0e27;padding:10px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">Voir le contrat</a></div>
  </td></tr>
  <tr><td style="padding:16px 0 0 0;text-align:center;font-size:11px;color:#8b92b8;">Alerte automatique ALBA (60 et 30 jours avant la fin). Ne pas répondre.</td></tr>
</table></td></tr></table></body></html>`;

      if (emails.length) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "ALBA by Nikito <noreply@nikito.tech>", to: emails, subject: titre, html }),
        });
        if (!r.ok) {
          // Palier libéré pour un nouvel essai demain
          await service.from("alertes_contrats_envoyees").delete().eq("document_id", c.id).eq("palier", palier);
          console.error("alertes-fin-contrats: Resend", r.status, await r.text());
          continue;
        }
      }
      for (const u of destinataires) {
        await service.rpc("notifier_push", {
          p_utilisateur_id: u.id,
          p_titre: `Fin de contrat dans ${jours} j`,
          p_corps: `${c.titre}${c.parc ? ` · ${c.parc.code}` : ""}`,
          p_url: "/gmao/contrats",
        });
      }
      envoyes++;
    }
    return repondre({ success: true, alertes: envoyes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("alertes-fin-contrats:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
