import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MOTS_PROBLEME = [
  "casse", "cassee", "casser",
  "panne", "en panne", "hors service", "hs",
  "ne marche pas", "marche pas", "fonctionne pas", "ne fonctionne plus", "ne marche plus",
  "ferme", "fermee", "ferme au public",
  "degrade", "degradee", "vetuste",
  "dangereux", "dangereuse", "danger", "pas securise", "pas aux normes",
  "defectueux", "defectueuse", "defaillance", "defaillant",
  "abime", "abimee",
  "sale", "salete", "pas propre", "pas nettoye", "degueulasse", "crade", "moisi", "odeur",
  "en reparation",
  "fuite", "bouche", "inonde",
  "broken", "dirty", "unsafe", "out of order", "not working", "doesn't work",
  "filthy", "disgusting", "smell",
];

const MOTS_EQUIPEMENT = [
  "trampoline", "trampo", "ressort", "filet", "mousse", "tapis",
  "laser", "laser game", "blaster", "gilet", "pistolet",
  "karting", "kart", "volant", "pedale", "frein",
  "bowling", "piste", "quille", "boule",
  "arcade", "borne", "manette", "joystick", "ecran",
  "prison island", "prison",
  "ninja", "parcours", "escalade",
  "mini golf", "minigolf", "putter",
  "casier", "vestiaire",
  "toilette", "toilettes", "wc", "sanitaire", "sanitaires",
  "soft play", "structure", "gonflable", "aire de jeux",
  "clim", "climatisation", "chauffage",
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shouldImport(commentaire: string, rating: number): boolean {
  if (rating <= 2) return true;
  const texte = normalizeText(commentaire);
  const aProbleme = MOTS_PROBLEME.some((m) => texte.includes(m));
  if (rating === 3) {
    const aEquipement = MOTS_EQUIPEMENT.some((m) => texte.includes(m));
    return aProbleme || aEquipement;
  }
  return aProbleme;
}

function detecterPriorite(rating: number): string {
  if (rating === 1) return "critique";
  if (rating === 2) return "haute";
  return "normale";
}

const ALBA_TO_ROLLER: Record<string, string> = {
  ALF: "ALF",
  FRA: "FRA",
  SGB: "SGB",
  DOM: "ROSNY",
};

const ROLLER_TO_ALBA: Record<string, string> = {
  ALF: "ALF",
  FRA: "FRA",
  SGB: "SGB",
  ROSNY: "DOM",
};

function detecterParcAlba(venueCodeOrName: string): string | null {
  const v = venueCodeOrName.toUpperCase().trim();
  if (ROLLER_TO_ALBA[v]) return ROLLER_TO_ALBA[v];
  const low = v.toLowerCase();
  if (low.includes("alfortville")) return "ALF";
  if (low.includes("franconville")) return "FRA";
  if (low.includes("genevieve") || low.includes("ste ge") || low.includes("sainte-ge")) return "SGB";
  if (low.includes("rosny") || low.includes("domus")) return "DOM";
  return null;
}

async function getDateDepart(
  supabase: SupabaseClient,
  parcId: string,
): Promise<string> {
  const { data: lastAvis } = await supabase
    .from("plaintes_clients")
    .select("date_visite")
    .eq("parc_id", parcId)
    .eq("source", "roller_gxs")
    .order("date_visite", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAvis?.date_visite) {
    const d = new Date(lastAvis.date_visite);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

async function logSync(
  supabase: SupabaseClient,
  entry: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("roller_sync_log").insert({
      sync_type: "gxs",
      endpoint: "/reporting/gxs",
      started_at: entry.started_at,
      finished_at: new Date().toISOString(),
      ...entry,
    });
  } catch (e) {
    console.error("[GXS] log insert error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID");
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET");
    const apiUrl = Deno.env.get("ROLLER_API_URL") || "https://api.roller.app";

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "Secrets ROLLER_CLIENT_ID et ROLLER_CLIENT_SECRET manquants",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenRes = await fetch(`${apiUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      await logSync(supabase, {
        started_at: startedAt,
        status: "error",
        http_status: tokenRes.status,
        error_message: `Auth Roller echouee: ${detail.slice(0, 500)}`,
      });
      return new Response(
        JSON.stringify({ error: "Auth Roller echouee", detail }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = (await tokenRes.json()).access_token;

    const { data: parcs, error: parcsErr } = await supabase
      .from("parcs")
      .select("id, code")
      .in("code", ["ALF", "FRA", "SGB", "DOM"]);

    if (parcsErr || !parcs) {
      await logSync(supabase, {
        started_at: startedAt,
        status: "error",
        error_message: `Parcs load failed: ${parcsErr?.message}`,
      });
      throw parcsErr ?? new Error("Parcs vides");
    }

    const parcByCode = new Map(parcs.map((p) => [p.code, p.id]));
    const today = new Date().toISOString().split("T")[0];

    const totaux = {
      total_received: 0,
      total_inserted: 0,
      total_skipped_dedup: 0,
      total_skipped_rating: 0,
      total_skipped_keywords: 0,
      total_skipped_other: 0,
    };

    const metaParParc: Record<string, Record<string, unknown>> = {};

    for (const [albaCode, parcId] of parcByCode) {
      const rollerVenue = ALBA_TO_ROLLER[albaCode] ?? albaCode;
      const startDate = await getDateDepart(supabase, parcId);

      const url =
        `${apiUrl}/reporting/gxs?startDate=${startDate}&endDate=${today}&venueCode=${rollerVenue}`;
      const gxsRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json;charset=UTF-8",
        },
      });

      if (!gxsRes.ok) {
        metaParParc[albaCode] = {
          venue_envoye: rollerVenue,
          startDate,
          endDate: today,
          http_status: gxsRes.status,
          error: (await gxsRes.text()).slice(0, 300),
        };
        continue;
      }

      const gxsData = await gxsRes.json();
      const reponses: any[] = Array.isArray(gxsData)
        ? gxsData
        : gxsData.data || gxsData.results || gxsData.items || [];

      let skipRating = 0;
      let skipKeywords = 0;
      let skipDedup = 0;
      let skipOther = 0;
      let inserted = 0;

      for (const r of reponses) {
        const rating = Number(
          r.rating ?? r.overallRating ?? r.score ?? r.stars ?? 0,
        );
        const commentaire = String(
          r.comment ?? r.feedback ?? r.text ?? r.verbatim ?? "",
        );

        if (rating === 0) {
          skipOther++;
          continue;
        }

        if (!shouldImport(commentaire, rating)) {
          if (rating >= 4) skipRating++;
          else skipKeywords++;
          continue;
        }

        const rollerId = String(
          r.id ?? r.responseId ?? r.surveyId ?? r.guestId ??
            `gxs_${albaCode}_${r.visitDate ?? today}_${Math.random().toString(36).slice(2, 10)}`,
        );

        const { data: existing } = await supabase
          .from("plaintes_clients")
          .select("id")
          .eq("source_externe_id", rollerId)
          .limit(1);

        if (existing && existing.length > 0) {
          skipDedup++;
          continue;
        }

        const dateVisite = r.visitDate ?? r.date ?? r.bookingDate ?? r.responseDate ?? today;

        const { error: insErr } = await supabase
          .from("plaintes_clients")
          .insert({
            parc_id: parcId,
            source: "roller_gxs",
            source_externe_id: rollerId,
            client_nom:
              r.customerName ?? r.name ?? r.guestName ?? "Client anonyme",
            client_email: r.customerEmail ?? r.email ?? r.guestEmail ?? null,
            client_telephone:
              r.customerPhone ?? r.phone ?? r.guestPhone ?? null,
            date_visite: dateVisite,
            note_globale: rating,
            commentaire: commentaire || null,
            categorie: "maintenance",
            statut: "a_qualifier",
            priorite: detecterPriorite(rating),
            est_formation: false,
          });

        if (insErr) {
          skipOther++;
          console.error(`[GXS][${albaCode}] insert error:`, insErr.message);
          continue;
        }

        inserted++;
      }

      metaParParc[albaCode] = {
        venue_envoye: rollerVenue,
        startDate,
        endDate: today,
        items_received: reponses.length,
        items_skipped_rating: skipRating,
        items_skipped_keywords: skipKeywords,
        items_skipped_dedup: skipDedup,
        items_skipped_other: skipOther,
        items_inserted: inserted,
      };

      totaux.total_received += reponses.length;
      totaux.total_inserted += inserted;
      totaux.total_skipped_dedup += skipDedup;
      totaux.total_skipped_rating += skipRating;
      totaux.total_skipped_keywords += skipKeywords;
      totaux.total_skipped_other += skipOther;
    }

    await logSync(supabase, {
      started_at: startedAt,
      status: "success",
      http_status: 200,
      items_received: totaux.total_received,
      items_inserted: totaux.total_inserted,
      items_skipped: totaux.total_skipped_dedup + totaux.total_skipped_rating +
        totaux.total_skipped_keywords + totaux.total_skipped_other,
      meta: { par_parc: metaParParc, totaux },
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...totaux,
        par_parc: metaParParc,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[GXS] Error:", err);
    await logSync(supabase, {
      started_at: startedAt,
      status: "error",
      error_message: String(err?.message ?? err).slice(0, 500),
    });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
