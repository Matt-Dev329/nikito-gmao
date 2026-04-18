import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    const { data: managers } = await supabase
      .from("utilisateurs")
      .select(
        "id, email, prenom, nom, roles!inner(code), parcs_utilisateurs(parc_id)",
      )
      .eq("roles.code", "manager_parc")
      .eq("actif", true);

    if (!managers || managers.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun manager de parc actif" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recaps: Array<{
      manager: string;
      email: string;
      parcs: Array<{
        parc_id: string;
        terminees: number;
        en_cours: number;
        en_attente: number;
        taux_resolution: number;
      }>;
    }> = [];

    for (const mgr of managers as any[]) {
      const parcIds = (mgr.parcs_utilisateurs as any[]).map(
        (pu: any) => pu.parc_id,
      );
      if (parcIds.length === 0) continue;

      const parcRecaps: Array<{
        parc_id: string;
        terminees: number;
        en_cours: number;
        en_attente: number;
        taux_resolution: number;
      }> = [];

      for (const parcId of parcIds) {
        const { data: equipIds } = await supabase
          .from("equipements")
          .select("id")
          .eq("parc_id", parcId)
          .eq("est_formation", false);

        if (!equipIds || equipIds.length === 0) continue;

        const eqIds = equipIds.map((e: any) => e.id);

        const [termineeRes, enCoursRes, attenteRes, totalJourRes] =
          await Promise.all([
            supabase
              .from("incidents")
              .select("id", { count: "exact", head: true })
              .in("equipement_id", eqIds)
              .in("statut", ["resolu", "ferme"])
              .gte("resolu_le", todayStart)
              .lte("resolu_le", todayEnd)
              .eq("est_formation", false),
            supabase
              .from("incidents")
              .select("id", { count: "exact", head: true })
              .in("equipement_id", eqIds)
              .eq("statut", "en_cours")
              .eq("est_formation", false),
            supabase
              .from("incidents")
              .select("id", { count: "exact", head: true })
              .in("equipement_id", eqIds)
              .in("statut", ["ouvert", "assigne"])
              .eq("est_formation", false),
            supabase
              .from("incidents")
              .select("id", { count: "exact", head: true })
              .in("equipement_id", eqIds)
              .gte("declare_le", todayStart)
              .lte("declare_le", todayEnd)
              .eq("est_formation", false),
          ]);

        const terminees = termineeRes.count ?? 0;
        const enCours = enCoursRes.count ?? 0;
        const enAttente = attenteRes.count ?? 0;
        const totalJour = totalJourRes.count ?? 0;
        const taux =
          totalJour > 0 ? Math.round((terminees / totalJour) * 100) : 100;

        parcRecaps.push({
          parc_id: parcId,
          terminees,
          en_cours: enCours,
          en_attente: enAttente,
          taux_resolution: taux,
        });
      }

      recaps.push({
        manager: `${mgr.prenom} ${mgr.nom}`,
        email: mgr.email,
        parcs: parcRecaps,
      });

      // TODO: Send email via Resend/SMTP when CRON is connected
      // For now, just collect the data
    }

    return new Response(
      JSON.stringify({
        message: `Recap genere pour ${recaps.length} manager(s)`,
        date: today,
        recaps,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
