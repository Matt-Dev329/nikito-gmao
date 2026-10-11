import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

// Appelée par notifier_push() (pg_net) avec l'id d'une notification : relit la
// notification en base, l'envoie à tous les appareils actifs du destinataire,
// désactive les abonnements expirés (404/410). Idempotente (envoye_le).

const VAPID_PUBLIC =
  "BFo_nYNpJ1QWeCndYm1grpRSKXg5f43aUGcWdSxQLmXzcScZ-3mpGWaHpWYH0pHlTak0ELy-ICUf_jAXCWb5wbk";
const VAPID_CONTACT = "https://nikito.tech";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let notifId: number | null = null;

  try {
    const { notification_id } = await req.json();
    if (!notification_id) return json({ success: false, error: "notification_id manquant" }, 400);

    // Réserve l'envoi : une seule fois par notification
    const { data: notif } = await supabase
      .from("push_notifications")
      .update({ envoye_le: new Date().toISOString() })
      .eq("id", notification_id)
      .is("envoye_le", null)
      .select("id, utilisateur_id, titre, corps, url")
      .maybeSingle();
    if (!notif) return json({ success: true, skipped: "deja_envoyee_ou_introuvable" });
    notifId = notif.id;

    const { data: cle, error: cleErr } = await supabase.rpc("vapid_cle_privee");
    if (cleErr || !cle) throw new Error("Clé VAPID introuvable");
    webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, cle as string);

    const { data: abonnements } = await supabase
      .from("push_abonnements")
      .select("id, endpoint, p256dh, auth")
      .eq("utilisateur_id", notif.utilisateur_id)
      .eq("actif", true);

    const charge = JSON.stringify({ titre: notif.titre, corps: notif.corps ?? "", url: notif.url ?? "/" });
    let envoyes = 0;
    const erreurs: string[] = [];

    for (const a of abonnements ?? []) {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          // Appareil désabonné / abonnement expiré
          await supabase.from("push_abonnements").update({ actif: false, modifie_le: new Date().toISOString() }).eq("id", a.id);
        } else {
          erreurs.push(`${code ?? "?"}: ${String((e as Error).message ?? e).slice(0, 120)}`);
        }
      }
    }

    await supabase
      .from("push_notifications")
      .update({ resultat: `${envoyes} envoyé(s)${erreurs.length ? ` · erreurs : ${erreurs.join(" | ")}` : ""}` })
      .eq("id", notif.id);

    return json({ success: true, envoyes, erreurs: erreurs.length });
  } catch (err) {
    console.error("envoyer-push error:", err);
    if (notifId) {
      await supabase.from("push_notifications").update({ resultat: `erreur : ${String(err).slice(0, 200)}` }).eq("id", notifId);
    }
    return json({ success: false, error: "Erreur interne" }, 500);
  }
});
