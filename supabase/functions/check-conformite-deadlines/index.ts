import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ACTIVE_STATUSES = ["a_lever", "en_cours", "levee_proposee"];

interface Destinataire {
  id: string;
  email: string | null;
  prenom: string | null;
  role_code: string;
}

async function getDestinataires(
  supabase: ReturnType<typeof createClient>,
  parcId: string,
): Promise<Destinataire[]> {
  const { data: directChef } = await supabase
    .from("utilisateurs")
    .select("id, email, prenom, roles!inner(code)")
    .eq("actif", true)
    .in("roles.code", ["direction", "chef_maintenance"]);

  const result: Destinataire[] = (directChef ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    prenom: u.prenom,
    role_code: u.roles.code,
  }));

  const { data: managers } = await supabase
    .from("parcs_utilisateurs")
    .select("utilisateurs!inner(id, email, prenom, actif, roles!inner(code))")
    .eq("parc_id", parcId);

  for (const pu of (managers ?? []) as any[]) {
    const u = pu.utilisateurs;
    if (u && u.actif && u.roles.code === "manager_parc") {
      if (!result.some((r) => r.id === u.id)) {
        result.push({ id: u.id, email: u.email, prenom: u.prenom, role_code: u.roles.code });
      }
    }
  }

  return result;
}

async function notificationExists(
  supabase: ReturnType<typeof createClient>,
  destinataireId: string,
  type: string,
  prescriptionId: string | null,
  commissionId: string | null,
  parcId: string | null,
  sinceIso: string,
): Promise<boolean> {
  let q = supabase
    .from("notifications_conformite")
    .select("id", { count: "exact", head: true })
    .eq("destinataire_id", destinataireId)
    .eq("type_notification", type)
    .gte("cree_le", sinceIso);

  if (prescriptionId) q = q.eq("prescription_id", prescriptionId);
  if (commissionId) q = q.eq("commission_id", commissionId);
  if (parcId && !prescriptionId && !commissionId) q = q.eq("parc_id", parcId);

  const { count } = await q;
  return (count ?? 0) > 0;
}

async function sendEmail(payload: Record<string, unknown>): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-conformite-email`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("sendEmail error:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x;
    };
    const startOfDayIso = today.toISOString();

    const stats = {
      prescriptions_j30: 0,
      prescriptions_j7: 0,
      prescriptions_j1: 0,
      prescriptions_retard: 0,
      commissions_j7: 0,
      commissions_j1: 0,
      toutes_reserves_levees: 0,
      emails_envoyes: 0,
    };

    const dateMap: Array<{ label: string; type: string; date: string; subjectDays: number | null; retard: boolean }> = [
      { label: "j30", type: "prescription_j30", date: iso(addDays(today, 30)), subjectDays: 30, retard: false },
      { label: "j7", type: "prescription_j7", date: iso(addDays(today, 7)), subjectDays: 7, retard: false },
      { label: "j1", type: "prescription_j1", date: iso(addDays(today, 1)), subjectDays: 1, retard: false },
    ];

    // Prescriptions J-30 / J-7 / J-1
    for (const entry of dateMap) {
      const { data: prescriptions } = await supabase
        .from("prescriptions_securite")
        .select("id, parc_id, numero_prescription, intitule, gravite, delai_levee, statut, responsable_id, parcs(nom)")
        .in("statut", ACTIVE_STATUSES)
        .eq("delai_levee", entry.date);

      for (const p of (prescriptions ?? []) as any[]) {
        const destinataires = await getDestinataires(supabase, p.parc_id);
        if (p.responsable_id && !destinataires.some((d) => d.id === p.responsable_id)) {
          const { data: resp } = await supabase
            .from("utilisateurs")
            .select("id, email, prenom, roles!inner(code)")
            .eq("id", p.responsable_id)
            .eq("actif", true)
            .maybeSingle();
          if (resp) destinataires.push({ id: resp.id, email: resp.email, prenom: resp.prenom, role_code: (resp as any).roles.code });
        }

        for (const d of destinataires) {
          if (await notificationExists(supabase, d.id, entry.type, p.id, null, null, startOfDayIso)) continue;

          const titre = `Reserve ${p.numero_prescription ?? ""} - echeance dans ${entry.subjectDays} jour${entry.subjectDays! > 1 ? "s" : ""}`;
          const message = `${p.parcs?.nom ?? ""} - ${p.intitule ?? ""} (gravite ${p.gravite ?? "n/a"})`;

          const { data: notif } = await supabase
            .from("notifications_conformite")
            .insert({
              destinataire_id: d.id,
              parc_id: p.parc_id,
              type_notification: entry.type,
              prescription_id: p.id,
              titre,
              message,
            })
            .select("id")
            .maybeSingle();

          stats[`prescriptions_${entry.label}` as keyof typeof stats]++;

          if (d.email && notif) {
            await sendEmail({
              notification_id: notif.id,
              destinataire_email: d.email,
              destinataire_prenom: d.prenom,
              type_notification: entry.type,
              titre,
              message,
              parc_nom: p.parcs?.nom ?? null,
              prescription: {
                numero: p.numero_prescription,
                intitule: p.intitule,
                gravite: p.gravite,
                delai_levee: p.delai_levee,
              },
              link_path: "/gmao/conformite/reserves",
            });
            stats.emails_envoyes++;
          }
        }
      }
    }

    // Prescriptions en retard
    const { data: retards } = await supabase
      .from("prescriptions_securite")
      .select("id, parc_id, numero_prescription, intitule, gravite, delai_levee, statut, responsable_id, parcs(nom)")
      .in("statut", ACTIVE_STATUSES)
      .lt("delai_levee", iso(today));

    for (const p of (retards ?? []) as any[]) {
      const destinataires = await getDestinataires(supabase, p.parc_id);
      if (p.responsable_id && !destinataires.some((d) => d.id === p.responsable_id)) {
        const { data: resp } = await supabase
          .from("utilisateurs")
          .select("id, email, prenom, roles!inner(code)")
          .eq("id", p.responsable_id)
          .eq("actif", true)
          .maybeSingle();
        if (resp) destinataires.push({ id: resp.id, email: resp.email, prenom: resp.prenom, role_code: (resp as any).roles.code });
      }

      for (const d of destinataires) {
        if (await notificationExists(supabase, d.id, "prescription_retard", p.id, null, null, startOfDayIso)) continue;

        const joursRetard = Math.floor((today.getTime() - new Date(p.delai_levee).getTime()) / 86400000);
        const titre = `Reserve EN RETARD : ${p.numero_prescription ?? ""}`;
        const message = `${p.parcs?.nom ?? ""} - ${p.intitule ?? ""} - ${joursRetard} jour${joursRetard > 1 ? "s" : ""} de retard`;

        const { data: notif } = await supabase
          .from("notifications_conformite")
          .insert({
            destinataire_id: d.id,
            parc_id: p.parc_id,
            type_notification: "prescription_retard",
            prescription_id: p.id,
            titre,
            message,
          })
          .select("id")
          .maybeSingle();

        stats.prescriptions_retard++;

        if (d.email && notif) {
          await sendEmail({
            notification_id: notif.id,
            destinataire_email: d.email,
            destinataire_prenom: d.prenom,
            type_notification: "prescription_retard",
            titre,
            message,
            parc_nom: p.parcs?.nom ?? null,
            prescription: {
              numero: p.numero_prescription,
              intitule: p.intitule,
              gravite: p.gravite,
              delai_levee: p.delai_levee,
            },
            link_path: "/gmao/conformite/reserves",
          });
          stats.emails_envoyes++;
        }
      }
    }

    // Commissions a venir J-7 / J-1
    for (const entry of [
      { days: 7, type: "commission_a_venir_j7", label: "j7" },
      { days: 1, type: "commission_a_venir_j1", label: "j1" },
    ]) {
      const target = iso(addDays(today, entry.days));
      const { data: commissions } = await supabase
        .from("commissions_securite")
        .select("id, parc_id, type_commission, date_visite, president_commission, parcs(nom)")
        .eq("date_visite", target);

      for (const c of (commissions ?? []) as any[]) {
        const destinataires = await getDestinataires(supabase, c.parc_id);

        for (const d of destinataires) {
          if (await notificationExists(supabase, d.id, entry.type, null, c.id, null, startOfDayIso)) continue;

          const titre = entry.days === 1
            ? `Commission ${c.type_commission} DEMAIN`
            : `Commission ${c.type_commission} dans ${entry.days} jours`;
          const message = `${c.parcs?.nom ?? ""} - ${c.date_visite}${c.president_commission ? ` - president : ${c.president_commission}` : ""}`;

          const { data: notif } = await supabase
            .from("notifications_conformite")
            .insert({
              destinataire_id: d.id,
              parc_id: c.parc_id,
              type_notification: entry.type,
              commission_id: c.id,
              titre,
              message,
            })
            .select("id")
            .maybeSingle();

          stats[`commissions_${entry.label}` as keyof typeof stats]++;

          if (d.email && notif) {
            await sendEmail({
              notification_id: notif.id,
              destinataire_email: d.email,
              destinataire_prenom: d.prenom,
              type_notification: entry.type,
              titre,
              message,
              parc_nom: c.parcs?.nom ?? null,
              commission: {
                type: c.type_commission,
                date_visite: c.date_visite,
              },
              link_path: "/gmao/conformite/commissions",
            });
            stats.emails_envoyes++;
          }
        }
      }
    }

    // Toutes reserves levees par parc
    const { data: parcs } = await supabase.from("parcs").select("id, nom").eq("actif", true);
    for (const parc of (parcs ?? []) as any[]) {
      const { count: totalCount } = await supabase
        .from("prescriptions_securite")
        .select("id", { count: "exact", head: true })
        .eq("parc_id", parc.id);

      if (!totalCount || totalCount === 0) continue;

      const { count: activesCount } = await supabase
        .from("prescriptions_securite")
        .select("id", { count: "exact", head: true })
        .eq("parc_id", parc.id)
        .in("statut", ACTIVE_STATUSES);

      if ((activesCount ?? 0) !== 0) continue;

      const sevenDaysAgo = addDays(today, -7).toISOString();
      const { data: recentValidated } = await supabase
        .from("prescriptions_securite")
        .select("id, modifie_le")
        .eq("parc_id", parc.id)
        .eq("statut", "levee_validee")
        .gte("modifie_le", sevenDaysAgo)
        .limit(1);

      if (!recentValidated || recentValidated.length === 0) continue;

      const destinataires = await getDestinataires(supabase, parc.id);

      for (const d of destinataires) {
        if (await notificationExists(supabase, d.id, "toutes_reserves_levees", null, null, parc.id, sevenDaysAgo)) continue;

        const titre = `Toutes les reserves sont levees`;
        const message = `${parc.nom} - l'ensemble des reserves est cloture`;

        const { data: notif } = await supabase
          .from("notifications_conformite")
          .insert({
            destinataire_id: d.id,
            parc_id: parc.id,
            type_notification: "toutes_reserves_levees",
            titre,
            message,
          })
          .select("id")
          .maybeSingle();

        stats.toutes_reserves_levees++;

        if (d.email && notif) {
          await sendEmail({
            notification_id: notif.id,
            destinataire_email: d.email,
            destinataire_prenom: d.prenom,
            type_notification: "toutes_reserves_levees",
            titre,
            message,
            parc_nom: parc.nom,
            link_path: "/gmao/conformite",
          });
          stats.emails_envoyes++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: iso(today), stats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-conformite-deadlines error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
