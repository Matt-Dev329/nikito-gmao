import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getISOWeek(): string {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configuree" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let estFormation = false;
    try {
      const body = await req.json();
      if (body.est_formation === true) estFormation = true;
    } catch {
      // no body or invalid JSON — default to production
    }

    const semaineIso = getISOWeek();

    const { data: existingRapport } = await supabase
      .from("rapports_ia_hebdo")
      .select("id")
      .eq("semaine_iso", semaineIso)
      .eq("est_formation", estFormation)
      .maybeSingle();

    if (existingRapport) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Rapport ${semaineIso} deja genere`,
          rapport_id: existingRapport.id,
          already_exists: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

    const [equipRes, incidentsRes, recurrencesRes] = await Promise.all([
      supabase
        .from("equipements")
        .select("id, code, libelle, parc_id, statut, date_mise_service, date_fin_garantie, a_surveiller, parcs(code, nom)")
        .neq("statut", "archive")
        .eq("est_formation", estFormation),
      supabase
        .from("incidents")
        .select("id, equipement_id, declare_le, statut")
        .gte("declare_le", d90)
        .eq("est_formation", estFormation),
      supabase
        .from("vue_recurrences_actives")
        .select("*")
        .eq("est_formation", estFormation),
    ]);

    const equipements = equipRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const recurrences = recurrencesRes.data ?? [];

    if (equipements.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucun equipement trouve" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();

    const incidentsByEquip = new Map<string, Array<Record<string, unknown>>>();
    for (const inc of incidents) {
      const eqId = (inc as Record<string, unknown>).equipement_id as string;
      if (!incidentsByEquip.has(eqId)) incidentsByEquip.set(eqId, []);
      incidentsByEquip.get(eqId)!.push(inc as Record<string, unknown>);
    }

    const recurrencesByEquip = new Map<string, Record<string, unknown>>();
    for (const rec of recurrences) {
      recurrencesByEquip.set((rec as Record<string, unknown>).equipement_id as string, rec as Record<string, unknown>);
    }

    const maintenanceData = {
      equipements: equipements.map((eq: Record<string, unknown>) => {
        const eqId = eq.id as string;
        const eqIncidents = incidentsByEquip.get(eqId) ?? [];
        const rec = recurrencesByEquip.get(eqId);
        const parc = eq.parcs as Record<string, unknown> | null;

        return {
          equipement_id: eqId,
          code: eq.code,
          libelle: eq.libelle,
          parc_code: parc?.code ?? "",
          parc_nom: parc?.nom ?? "",
          statut: eq.statut,
          date_mise_service: eq.date_mise_service,
          date_fin_garantie: eq.date_fin_garantie,
          a_surveiller: eq.a_surveiller,
          incidents_total: eqIncidents.length,
          incidents_30j: eqIncidents.filter((i) => new Date(i.declare_le as string) >= new Date(d30)).length,
          incidents_60j: eqIncidents.filter((i) => new Date(i.declare_le as string) >= new Date(d60)).length,
          incidents_90j: eqIncidents.length,
          recurrences: rec ? (rec.pannes_30j as number) : 0,
          pannes_30j: rec ? (rec.pannes_30j as number) : 0,
        };
      }),
      parcs: [...new Set(equipements.map((e: Record<string, unknown>) => e.parc_id))].map((pid) => {
        const eq = equipements.find((e: Record<string, unknown>) => e.parc_id === pid);
        const parc = (eq as Record<string, unknown>)?.parcs as Record<string, unknown> | null;
        return {
          parc_id: pid,
          parc_code: parc?.code ?? "",
          parc_nom: parc?.nom ?? "",
          incidents_ouverts: incidents.filter((i) => {
            const inc = i as Record<string, unknown>;
            const s = inc.statut as string;
            return (s === "ouvert" || s === "assigne" || s === "en_cours") &&
              equipements.find((e: Record<string, unknown>) => e.id === inc.equipement_id && e.parc_id === pid);
          }).length,
        };
      }),
      date_analyse: now.toISOString(),
    };

    const SYSTEM_PROMPT = `Tu es un expert en maintenance predictive pour des parcs de loisirs indoor.
Tu analyses les donnees de maintenance et tu retournes des predictions structurees.
Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "score_sante_global": number (0-100),
  "tendance": "stable" | "amelioration" | "degradation",
  "equipements_a_risque": [{"equipement_id":"","equipement_code":"","equipement_libelle":"","parc":"","score_risque":0,"prediction":"","justification":"","action_recommandee":"","priorite":"haute|moyenne|basse","date_panne_estimee":"YYYY-MM-DD"}],
  "alertes": [{"type":"garantie_expiration|controle_manquant|stock_critique|certification_expiration|tendance_degradation","message":"","parc":"","priorite":"haute|moyenne|basse"}],
  "recommandations": [{"titre":"","description":"","impact_estime":"","cout_estime":"","deadline_suggeree":"YYYY-MM-DD"}],
  "kpi_predictions": {"mtbf_prevu_30j":0,"incidents_prevus_30j":0,"taux_conformite_prevu":0,"equipements_necessitant_attention":0}
}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Donnees de maintenance des 90 derniers jours :\n${JSON.stringify(maintenanceData)}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errBody);
      return new Response(
        JSON.stringify({ success: false, error: `Erreur API IA (${anthropicRes.status})`, detail: errBody }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    const { data: rapport, error: rapportError } = await supabase
      .from("rapports_ia_hebdo")
      .insert({
        semaine_iso: semaineIso,
        score_sante: analysis.score_sante_global ?? 0,
        tendance: analysis.tendance ?? "stable",
        donnees_analyse: analysis,
        est_formation: estFormation,
      })
      .select("id")
      .single();

    if (rapportError) {
      console.error("Insert rapport error:", rapportError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur sauvegarde rapport", detail: rapportError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hypotheses: Array<Record<string, unknown>> = [];

    for (const eq of (analysis.equipements_a_risque ?? [])) {
      hypotheses.push({
        rapport_id: rapport.id,
        type: "equipement_risque",
        titre: `${eq.equipement_code ?? "?"} - Risque ${eq.score_risque ?? 0}%`,
        description: eq.prediction ?? eq.justification ?? "",
        donnees: eq,
        priorite: eq.priorite ?? "moyenne",
        est_formation: estFormation,
      });
    }

    for (const al of (analysis.alertes ?? [])) {
      hypotheses.push({
        rapport_id: rapport.id,
        type: "alerte",
        titre: al.message ?? "Alerte IA",
        description: `Type: ${(al.type ?? "").replace(/_/g, " ")} - Parc: ${al.parc ?? ""}`,
        donnees: al,
        priorite: al.priorite ?? "moyenne",
        est_formation: estFormation,
      });
    }

    for (const rec of (analysis.recommandations ?? [])) {
      hypotheses.push({
        rapport_id: rapport.id,
        type: "recommandation",
        titre: rec.titre ?? "Recommandation IA",
        description: rec.description ?? "",
        donnees: rec,
        priorite: "moyenne",
        est_formation: estFormation,
      });
    }

    if (hypotheses.length > 0) {
      const { error: hypError } = await supabase
        .from("hypotheses_ia")
        .insert(hypotheses);

      if (hypError) {
        console.error("Insert hypotheses error:", hypError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rapport_id: rapport.id,
        semaine: semaineIso,
        hypotheses_count: hypotheses.length,
        score_sante: analysis.score_sante_global,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generer-rapport-ia-hebdo error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur interne", detail: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
