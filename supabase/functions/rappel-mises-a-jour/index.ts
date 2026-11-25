import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Mail de rappel des mises à jour périodiques (ex. Laser Game 3 fois par an).
 * Appelée par rappels_mises_a_jour() (pg_cron, chaque matin) après qu'elle a
 * choisi les plannings à rappeler (dernier_rappel = aujourd'hui). N'envoie
 * qu'un mail par planning et par jour (rappel_mail_le), quel que soit le
 * nombre d'appels.
 * Destinataires : chef d'équipe, directeurs du parc, managers principaux.
 */

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const dateFr = (d: string) => {
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a}`;
};

function corpsMail(p: {
  libelle: string;
  parc: string;
  echeance: string;
  enRetard: boolean;
  derniere: string | null;
  siteUrl: string;
}): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;">
<p>Bonjour,</p>
<p style="background:${p.enRetard ? "#fdecef" : "#fff4e5"};border-left:4px solid ${p.enRetard ? "#d6336c" : "#e8590c"};padding:10px 14px;">
<strong>${p.enRetard ? "À faire maintenant" : "Rappel"} : ${echapper(p.libelle)} — ${echapper(p.parc)}</strong><br/>
${p.enRetard ? "Prévue le" : "À faire avant le"} <strong>${dateFr(p.echeance)}</strong>.
</p>
<p>La mise à jour est à faire 3 fois par an (tous les 4 mois).${p.derniere ? ` Dernière mise à jour enregistrée : ${dateFr(p.derniere)}.` : ""}</p>
<p>Une fois faite, enregistrez-la dans le registre ALBA (date, version, remarques) : le rappel s'arrête et la prochaine échéance est calculée automatiquement.</p>
<p><a href="${p.siteUrl}/gmao/mises-a-jour" style="display:inline-block;background:#5DE5FF;color:#0B0B2E;font-weight:700;text-decoration:none;padding:10px 22px;border-radius:8px;">Ouvrir « MAJ Laser Game » dans ALBA</a></p>
<p style="font-size:12px;color:#888;margin-top:28px;">Rappel automatique ALBA by Nikito (GMAO) — ne pas répondre.</p>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return repondre({ success: false }, 405);
  try {
    const cle = Deno.env.get("RESEND_API_KEY");
    if (!cle) return repondre({ success: false, error: "RESEND_API_KEY manquante" }, 500);
    const siteUrl = Deno.env.get("SITE_URL") || "https://nikito.tech";
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const { data: plans, error } = await service
      .from("mises_a_jour_plans")
      .select("id, parc_id, libelle, prochaine_echeance, derniere_execution, rappel_mail_le, parcs(nom)")
      .eq("actif", true)
      .eq("dernier_rappel", aujourdhui);
    if (error) throw error;

    const resultats: unknown[] = [];
    for (const plan of plans ?? []) {
      if (plan.rappel_mail_le === aujourdhui) continue;
      // Réserve l'envoi du jour avant d'écrire (pas de doublon si appels simultanés)
      const { data: pris } = await service
        .from("mises_a_jour_plans")
        .update({ rappel_mail_le: aujourdhui })
        .eq("id", plan.id)
        .or(`rappel_mail_le.is.null,rappel_mail_le.neq.${aujourdhui}`)
        .select("id");
      if (!pris?.length) continue;

      const { data: dest } = await service.rpc("destinataires_mise_a_jour", { p_parc: plan.parc_id });
      const emails = [...new Set((dest ?? []).map((d: { email: string | null }) => d.email).filter(Boolean))] as string[];
      if (emails.length === 0) continue;

      const parc = (plan.parcs as unknown as { nom: string } | null)?.nom ?? "";
      const enRetard = plan.prochaine_echeance < aujourdhui;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ALBA by Nikito <noreply@nikito.tech>",
          to: emails,
          subject: `${enRetard ? "À faire maintenant" : "Rappel"} : ${plan.libelle} — ${parc} (avant le ${dateFr(plan.prochaine_echeance)})`,
          html: corpsMail({
            libelle: plan.libelle,
            parc,
            echeance: plan.prochaine_echeance,
            enRetard,
            derniere: plan.derniere_execution,
            siteUrl,
          }),
        }),
      });
      if (!r.ok) {
        console.error("rappel-mises-a-jour: Resend", r.status, await r.text());
        // Échec : on libère pour un nouvel essai
        await service.from("mises_a_jour_plans").update({ rappel_mail_le: plan.rappel_mail_le }).eq("id", plan.id);
      }
      resultats.push({ plan: plan.id, ok: r.ok, destinataires: emails.length });
    }
    return repondre({ success: true, resultats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("rappel-mises-a-jour:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
