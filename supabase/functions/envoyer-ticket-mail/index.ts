import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Envoie un ticket par mail à une ou plusieurs personnes (prestataire,
 * collègue…) : numéro, parc, équipement, gravité, statut, description,
 * interventions déjà faites et liens vers les photos (valables 7 jours).
 *
 * Le ticket est lu avec le jeton de l'appelant : on ne peut envoyer que les
 * tickets qu'on a le droit de voir. L'appelant est en copie et en « répondre à ».
 * Chaque envoi est tracé dans le ticket (meta.envois_mail).
 *
 * Appel : POST { incident_id, destinataires: string[], message?: string }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_DESTINATAIRES = 5;
const DUREE_LIEN_PHOTO = 7 * 24 * 3600;
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const texte = (t: string) => echapper(t).replace(/\n/g, "<br/>");

const STATUTS: Record<string, string> = {
  ouvert: "À faire",
  assigne: "Assigné",
  en_cours: "En cours",
  en_pause: "En pause",
  resolu: "Résolu",
  ferme: "Fermé",
  annule: "Supprimé",
};

const dateFr = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })
    : "—";

type Ligne = [string, string | null | undefined];

function corpsMail(p: {
  expediteur: string;
  message: string;
  numero: string;
  titre: string;
  lignes: Ligne[];
  description: string | null;
  interventions: { tech: string; debut: string | null; fin: string | null; diagnostic: string | null; actions: string | null }[];
  photos: { nom: string; url: string }[];
}): string {
  const lignes = p.lignes
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top;">${echapper(k)}</td><td style="padding:4px 0;color:#1a1a2e;">${texte(String(v))}</td></tr>`
    )
    .join("");
  const interventions = p.interventions
    .map(
      (iv) => `<div style="border-left:3px solid #5DE5FF;padding:6px 12px;margin:8px 0;background:#f5f7fb;">
<div style="font-size:13px;color:#666;">${echapper(iv.tech)} · ${dateFr(iv.debut)}${iv.fin ? ` → ${dateFr(iv.fin)}` : " (en cours)"}</div>
${iv.diagnostic ? `<div><strong>Diagnostic :</strong> ${texte(iv.diagnostic)}</div>` : ""}
${iv.actions ? `<div><strong>Actions :</strong> ${texte(iv.actions)}</div>` : ""}
</div>`
    )
    .join("");
  const photos = p.photos
    .map((ph) => `<li><a href="${echapper(ph.url)}" style="color:#0a7ea4;">${echapper(ph.nom)}</a></li>`)
    .join("");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;">
<p>Bonjour,</p>
<p>${echapper(p.expediteur)} vous transmet le ticket de maintenance <strong>${echapper(p.numero)}</strong>.</p>
${p.message ? `<p style="background:#f5f7fb;border-left:4px solid #5DE5FF;padding:10px 14px;">${texte(p.message)}</p>` : ""}
<h2 style="font-size:17px;margin:20px 0 8px;">${echapper(p.numero)} — ${echapper(p.titre)}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${lignes}</table>
${p.description ? `<h3 style="font-size:15px;margin:18px 0 6px;">Description</h3><p>${texte(p.description)}</p>` : ""}
${interventions ? `<h3 style="font-size:15px;margin:18px 0 6px;">Interventions</h3>${interventions}` : ""}
${photos ? `<h3 style="font-size:15px;margin:18px 0 6px;">Photos / vidéos</h3><ul>${photos}</ul><p style="font-size:12px;color:#666;">Liens valables 7 jours.</p>` : ""}
<p style="margin-top:24px;">Pour toute question, répondez simplement à ce mail.</p>
<p style="font-size:12px;color:#888;margin-top:28px;">Envoyé depuis ALBA by Nikito (GMAO).</p>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return repondre({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const corps = await req.json().catch(() => ({}));
    const incidentId = typeof corps.incident_id === "string" ? corps.incident_id : null;
    const message = typeof corps.message === "string" ? corps.message.trim().slice(0, 2000) : "";
    const destinataires: string[] = Array.isArray(corps.destinataires)
      ? [...new Set(corps.destinataires.filter((d: unknown) => typeof d === "string").map((d: string) => d.trim().toLowerCase()))]
      : [];
    if (!incidentId) return repondre({ success: false, error: "Ticket manquant" }, 400);
    if (destinataires.length === 0) return repondre({ success: false, error: "Indique au moins une adresse mail" }, 400);
    if (destinataires.length > MAX_DESTINATAIRES)
      return repondre({ success: false, error: `${MAX_DESTINATAIRES} destinataires maximum` }, 400);
    const invalide = destinataires.find((d) => !EMAIL.test(d) || d.length > 200);
    if (invalide) return repondre({ success: false, error: `Adresse invalide : ${invalide}` }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return repondre({ success: false, error: "Envoi de mails non configuré" }, 500);

    // Appelant : compte interne connecté (le staff PIN n'a pas de session)
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const appelant = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
    });
    const { data: auth } = await appelant.auth.getUser(jeton);
    if (!auth?.user) return repondre({ success: false, error: "Connecte-toi pour envoyer un ticket" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: moi } = await service
      .from("utilisateurs")
      .select("id, prenom, nom, email, actif")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle();
    if (!moi?.actif) return repondre({ success: false, error: "Compte introuvable ou désactivé" }, 403);

    // Le ticket est lu avec les droits de l'appelant
    const { data: inc, error: errInc } = await appelant
      .from("incidents")
      .select(
        "id, numero_bt, titre, description, statut, declare_le, declare_par_nom, declare_par_id, photos_urls, pause_motif, attente_piece, attente_piece_detail, externe, externe_nom, externe_date_prevue, meta, equipement_id, niveaux_priorite(nom), equipements(code, libelle)"
      )
      .eq("id", incidentId)
      .maybeSingle();
    if (errInc || !inc) return repondre({ success: false, error: "Ticket introuvable ou non accessible" }, 404);

    const { data: parcId } = await appelant.rpc("parc_de_ticket", {
      p_equipement_id: inc.equipement_id,
      p_meta: inc.meta,
      p_declare_par_id: inc.declare_par_id,
    });
    const { data: parc } = parcId
      ? await service.from("parcs").select("nom").eq("id", parcId).maybeSingle()
      : { data: null };

    const { data: ivs } = await service
      .from("interventions")
      .select("debut, fin, diagnostic, actions_realisees, photos_avant, photos_apres, technicien_id")
      .eq("incident_id", incidentId)
      .order("debut");
    const techIds = [...new Set((ivs ?? []).map((iv) => iv.technicien_id).filter(Boolean))];
    const { data: techs } = techIds.length
      ? await service.from("utilisateurs").select("id, prenom, nom").in("id", techIds)
      : { data: [] as { id: string; prenom: string; nom: string }[] };
    const nomTech = new Map((techs ?? []).map((t) => [t.id, `${t.prenom ?? ""} ${t.nom ?? ""}`.trim()]));

    // Liens temporaires vers les photos / vidéos
    const photos: { nom: string; url: string }[] = [];
    const signer = async (bucket: string, chemins: string[] | null | undefined, libelle: string) => {
      for (const [i, chemin] of (chemins ?? []).filter(Boolean).entries()) {
        const { data } = await service.storage.from(bucket).createSignedUrl(chemin, DUREE_LIEN_PHOTO);
        if (data?.signedUrl) photos.push({ nom: `${libelle} ${i + 1}${/\.(mov|mp4|webm)$/i.test(chemin) ? " (vidéo)" : ""}`, url: data.signedUrl });
      }
    };
    await signer("alba-incidents", inc.photos_urls as string[] | null, "Signalement");
    for (const iv of ivs ?? []) {
      await signer("alba-interventions", iv.photos_avant as string[] | null, "Avant intervention");
      await signer("alba-interventions", iv.photos_apres as string[] | null, "Après intervention");
    }

    const equip = inc.equipements as unknown as { code: string; libelle: string } | null;
    const gravite = (inc.niveaux_priorite as unknown as { nom: string } | null)?.nom ?? null;
    const expediteur = `${moi.prenom ?? ""} ${moi.nom ?? ""}`.trim();
    const etat = [
      inc.pause_motif ? `En pause : ${inc.pause_motif}` : null,
      inc.attente_piece ? `En attente de pièce${inc.attente_piece_detail ? ` : ${inc.attente_piece_detail}` : ""}` : null,
      inc.externe ? `Confié à ${inc.externe_nom ?? "un intervenant extérieur"}${inc.externe_date_prevue ? ` (prévu le ${inc.externe_date_prevue})` : ""}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const html = corpsMail({
      expediteur,
      message,
      numero: inc.numero_bt,
      titre: inc.titre ?? "",
      lignes: [
        ["Parc", parc?.nom],
        ["Équipement", equip ? `${equip.libelle} (${equip.code})` : null],
        ["Gravité", gravite],
        ["Statut", STATUTS[inc.statut] ?? inc.statut],
        ["Suivi", etat || null],
        ["Déclaré le", dateFr(inc.declare_le)],
        ["Déclaré par", inc.declare_par_nom],
      ],
      description: inc.description,
      interventions: (ivs ?? []).map((iv) => {
        return {
          tech: nomTech.get(iv.technicien_id) || "Technicien",
          debut: iv.debut,
          fin: iv.fin,
          diagnostic: iv.diagnostic,
          actions: iv.actions_realisees,
        };
      }),
      photos,
    });

    const envoi = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ALBA by Nikito <noreply@nikito.tech>",
        to: destinataires,
        ...(moi.email ? { cc: [moi.email], reply_to: moi.email } : {}),
        subject: `Ticket ${inc.numero_bt}${parc?.nom ? ` — ${parc.nom}` : ""} — ${inc.titre ?? ""}`.slice(0, 200),
        html,
      }),
    });
    if (!envoi.ok) {
      console.error("envoyer-ticket-mail: Resend", envoi.status, await envoi.text());
      return repondre({ success: false, error: `Envoi du mail impossible (${envoi.status})` }, 502);
    }

    // Trace dans le ticket
    const meta = (inc.meta ?? {}) as Record<string, unknown>;
    const envois = Array.isArray(meta.envois_mail) ? meta.envois_mail : [];
    await service
      .from("incidents")
      .update({
        meta: {
          ...meta,
          envois_mail: [...envois, { le: new Date().toISOString(), par_id: moi.id, par_nom: expediteur, a: destinataires, message: message || null }],
        },
      })
      .eq("id", incidentId);

    return repondre({ success: true, destinataires });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("envoyer-ticket-mail:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
