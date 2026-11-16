import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Mail à chaque déclaration de blessé (formulaire d'accident), au chef
 * d'équipe, aux directeurs et aux managers principaux du parc.
 * Appelée par le trigger trg_notifier_blesse (pg_net) avec { id }.
 * Un seul mail par déclaration (colonne mail_envoye_le), quel que soit le
 * nombre d'appels. Adresse, téléphone et date de naissance du blessé ne sont
 * pas dans le mail : ils restent dans ALBA (registre « Blessés »).
 */

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const texte = (t: string) => echapper(t).replace(/\n/g, "<br/>");

const NIVEAUX: Record<number, { label: string; couleur: string }> = {
  1: { label: "Niveau 1 — blessure mineure et passagère", couleur: "#2f9e44" },
  2: { label: "Niveau 2 — blessure modérée, sans secouristes", couleur: "#e8590c" },
  3: { label: "Niveau 3 — blessure importante (avis médical / secouristes)", couleur: "#d6336c" },
};

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
const ouiNon = (b: boolean | null) => (b === null ? "—" : b ? "Oui" : "Non");

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

    // Réserve l'envoi (une seule fois par déclaration)
    const { data: pris } = await service
      .from("declarations_blesses")
      .update({ mail_envoye_le: new Date().toISOString() })
      .eq("id", id)
      .is("mail_envoye_le", null)
      .select("*, parcs(nom)");
    const d = pris?.[0];
    if (!d) return repondre({ success: true, envoye: 0 });

    const { data: dest } = await service.rpc("destinataires_mise_a_jour", { p_parc: d.parc_id });
    const emails = [...new Set((dest ?? []).map((x: { email: string | null }) => x.email).filter(Boolean))] as string[];
    if (!emails.length) return repondre({ success: true, envoye: 0 });

    const parc = (d.parcs as { nom: string } | null)?.nom ?? "";
    const niv = NIVEAUX[d.niveau as number] ?? { label: "—", couleur: "#868e96" };
    const lignes: [string, string][] = [
      ["Parc / activité", `${parc} · ${d.activite ?? ""}`],
      ["Emplacement", d.emplacement ?? "—"],
      ["Date et heure", dateHeure(d.survenu_le)],
      ["Blessé", `${d.victime_prenom ?? ""} ${d.victime_nom ?? ""}${d.est_mineur ? " (mineur)" : ""}`],
      ["Blessure", d.blessure ?? "—"],
      ["Se déplace seul", d.peut_se_deplacer === false ? "Non, intervention sur la structure" : ouiNon(d.peut_se_deplacer)],
      ["Secouristes", d.secouristes ? `Oui${d.secouristes_heure ? `, pris en charge à ${String(d.secouristes_heure).slice(0, 5)}` : ""}` : ouiNon(d.secouristes)],
      ["Staff référent", d.staff_referent ?? "—"],
      ["Manager au courant", d.manager_informe ? `Oui · ${d.manager_prenom ?? ""}` : ouiNon(d.manager_informe)],
      ["Déclaré par", d.declare_par_nom ?? "—"],
    ];
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;">
<p style="border-left:4px solid ${niv.couleur};background:#f8f9fa;padding:10px 14px;margin:0 0 16px;">
<strong>${d.niveau === 3 ? "🚨 " : "🩹 "}Accident déclaré · ${echapper(parc)} · ${echapper(d.numero)}</strong><br/>${echapper(niv.label)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
${lignes.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#666;white-space:nowrap;vertical-align:top;">${echapper(k)}</td><td style="padding:4px 0;">${texte(v)}</td></tr>`).join("")}
</table>
${d.circonstances ? `<p style="margin-top:16px;"><strong>Détails :</strong><br/>${texte(d.circonstances)}</p>` : ""}
<p style="margin-top:18px;"><a href="${siteUrl}/gmao/blesses" style="display:inline-block;background:#5DE5FF;color:#0B0B2E;font-weight:700;text-decoration:none;padding:10px 22px;border-radius:8px;">Voir la déclaration complète dans ALBA</a></p>
<p style="font-size:12px;color:#888;margin-top:24px;">Coordonnées du blessé (adresse, téléphone, date de naissance) consultables uniquement dans ALBA. Données personnelles et de santé : ne pas transférer ce mail.</p>
</body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: emails,
        subject: `${d.niveau === 3 ? "🚨 " : ""}Accident · ${parc} · ${d.activite ?? ""} · niveau ${d.niveau ?? "?"} (${d.numero})`,
        html,
      }),
    });
    if (!r.ok) {
      console.error("notifier-blesse: Resend", r.status, await r.text());
      // Échec : on libère pour un nouvel essai
      await service.from("declarations_blesses").update({ mail_envoye_le: null }).eq("id", id);
      return repondre({ success: false, error: `Envoi impossible (${r.status})` }, 502);
    }
    return repondre({ success: true, envoye: emails.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("notifier-blesse:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
