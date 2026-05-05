import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VENUE_SECRET_KEYS: Record<string, string> = {
  ALF: "ALF",
  FRA: "FRA",
  SGB: "SGB",
  DOM: "ROSNY",
};

const BACKFILL_DAYS = 30;
const RATE_LIMIT_DELAY_MS = 600;

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

function isoDay(d: Date): string {
  return d.toISOString().split("T")[0];
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDay(d);
}

function daysRange(endDayStr: string, nbDays: number): string[] {
  const end = new Date(endDayStr);
  const out: string[] = [];
  for (let i = nbDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Auth Roller echouee (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()).access_token;
}

async function hasExistingGxs(
  supabase: SupabaseClient,
  parcId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("plaintes_clients")
    .select("id")
    .eq("parc_id", parcId)
    .eq("source", "roller_gxs")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function logStart(
  supabase: SupabaseClient,
  parcCode: string,
  venueRoller: string,
  startDate: string,
  endDate: string,
  mode: "nightly" | "rattrapage",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("roller_sync_log")
    .insert({
      sync_type: "gxs",
      endpoint: "/reporting/gxs",
      venue_code: parcCode,
      start_date: startDate,
      end_date: endDate,
      started_at: new Date().toISOString(),
      status: "running",
      meta: {
        parc_code: parcCode,
        venue_code_roller: venueRoller,
        modifiedDate_envoye: startDate,
        mode,
      },
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[GXS][${parcCode}] logStart error:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function logEnd(
  supabase: SupabaseClient,
  logId: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!logId) return;
  const { error } = await supabase
    .from("roller_sync_log")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", logId);
  if (error) console.error("[GXS] logEnd error:", error.message);
}

interface DayResult {
  day: string;
  http_status: number;
  items_received: number;
  items_inserted: number;
  skipRating: number;
  skipKeywords: number;
  skipDedup: number;
  skipOther: number;
  error?: string;
}

async function syncOneDay(
  supabase: SupabaseClient,
  apiUrl: string,
  token: string,
  parcId: string,
  albaCode: string,
  day: string,
): Promise<DayResult> {
  const res: DayResult = {
    day,
    http_status: 0,
    items_received: 0,
    items_inserted: 0,
    skipRating: 0,
    skipKeywords: 0,
    skipDedup: 0,
    skipOther: 0,
  };

  const url = `${apiUrl}/reporting/gxs?startDate=${day}&endDate=${day}`;
  const gxsRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
    },
  });
  res.http_status = gxsRes.status;

  if (!gxsRes.ok) {
    res.error = (await gxsRes.text()).slice(0, 300);
    return res;
  }

  const gxsData = await gxsRes.json();
  const reponses: any[] = Array.isArray(gxsData)
    ? gxsData
    : gxsData.data || gxsData.results || gxsData.items || [];
  res.items_received = reponses.length;

  for (const r of reponses) {
    const rating = Number(
      r.rating ?? r.overallRating ?? r.score ?? r.stars ?? 0,
    );
    const commentaire = String(
      r.comment ?? r.feedback ?? r.text ?? r.verbatim ?? "",
    );

    if (rating === 0) {
      res.skipOther++;
      continue;
    }

    if (!shouldImport(commentaire, rating)) {
      if (rating >= 4) res.skipRating++;
      else res.skipKeywords++;
      continue;
    }

    const rollerId = String(
      r.id ?? r.responseId ?? r.surveyId ?? r.guestId ??
        `gxs_${albaCode}_${r.visitDate ?? day}_${Math.random().toString(36).slice(2, 10)}`,
    );

    const { data: existing } = await supabase
      .from("plaintes_clients")
      .select("id")
      .eq("source_externe_id", rollerId)
      .limit(1);

    if (existing && existing.length > 0) {
      res.skipDedup++;
      continue;
    }

    const dateVisite = r.visitDate ?? r.date ?? r.bookingDate ?? r.responseDate ?? day;

    const { error: insErr } = await supabase
      .from("plaintes_clients")
      .insert({
        parc_id: parcId,
        source: "roller_gxs",
        source_externe_id: rollerId,
        client_nom: r.customerName ?? r.name ?? r.guestName ?? "Client anonyme",
        client_email: r.customerEmail ?? r.email ?? r.guestEmail ?? null,
        client_telephone: r.customerPhone ?? r.phone ?? r.guestPhone ?? null,
        date_visite: dateVisite,
        note_globale: rating,
        commentaire: commentaire || null,
        categorie: "maintenance",
        statut: "a_qualifier",
        priorite: detecterPriorite(rating),
        est_formation: false,
      });

    if (insErr) {
      res.skipOther++;
      console.error(`[GXS][${albaCode}][${day}] insert error:`, insErr.message);
      continue;
    }

    res.items_inserted++;
  }

  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const apiUrl = Deno.env.get("ROLLER_API_URL") || "https://api.roller.app";
    const tokenUrl = Deno.env.get("ROLLER_TOKEN_URL") || `${apiUrl}/token`;

    let forceBackfill = false;
    try {
      const body = await req.json();
      forceBackfill = body?.mode === "rattrapage" || body?.backfill === true;
    } catch (_) { /* empty body is fine */ }

    const { data: parcs, error: parcsErr } = await supabase
      .from("parcs")
      .select("id, code")
      .in("code", Object.keys(VENUE_SECRET_KEYS));

    if (parcsErr || !parcs) throw parcsErr ?? new Error("Parcs vides");

    const jHier = yesterday();

    const totaux = {
      total_received: 0,
      total_inserted: 0,
      total_skipped_dedup: 0,
      total_skipped_rating: 0,
      total_skipped_keywords: 0,
      total_skipped_other: 0,
    };

    const metaParParc: Record<string, Record<string, unknown>> = {};

    for (const parc of parcs) {
      const albaCode = parc.code;
      const venueKey = VENUE_SECRET_KEYS[albaCode];

      const aDejaImporte = await hasExistingGxs(supabase, parc.id);
      const mode: "nightly" | "rattrapage" =
        forceBackfill || !aDejaImporte ? "rattrapage" : "nightly";

      const jours = mode === "nightly"
        ? [jHier]
        : daysRange(jHier, BACKFILL_DAYS);
      const startDate = jours[0];
      const endDate = jours[jours.length - 1];

      const logId = await logStart(supabase, albaCode, venueKey, startDate, endDate, mode);

      const clientId = Deno.env.get(`ROLLER_${venueKey}_CLIENT_ID`);
      const clientSecret = Deno.env.get(`ROLLER_${venueKey}_CLIENT_SECRET`);

      if (!clientId || !clientSecret) {
        const errMsg = `Secrets ROLLER_${venueKey}_CLIENT_ID/SECRET manquants`;
        metaParParc[albaCode] = { venue_code_roller: venueKey, mode, error: errMsg };
        await logEnd(supabase, logId, {
          status: "error",
          error_message: errMsg,
          meta: {
            parc_code: albaCode,
            venue_code_roller: venueKey,
            modifiedDate_envoye: startDate,
            mode,
            error: errMsg,
          },
        });
        continue;
      }

      let token: string;
      try {
        token = await getAccessToken(tokenUrl, clientId, clientSecret);
      } catch (e: any) {
        const errMsg = String(e?.message ?? e).slice(0, 500);
        metaParParc[albaCode] = { venue_code_roller: venueKey, mode, auth_error: errMsg };
        await logEnd(supabase, logId, {
          status: "error",
          error_message: errMsg,
          meta: {
            parc_code: albaCode,
            venue_code_roller: venueKey,
            modifiedDate_envoye: startDate,
            mode,
            auth_error: errMsg,
          },
        });
        continue;
      }

      let totalReceived = 0;
      let totalInserted = 0;
      let totalSkipRating = 0;
      let totalSkipKeywords = 0;
      let totalSkipDedup = 0;
      let totalSkipOther = 0;
      let firstHttpError: { day: string; http_status: number; error: string } | null = null;
      const perDay: Array<Record<string, unknown>> = [];

      for (let i = 0; i < jours.length; i++) {
        const day = jours[i];
        const res = await syncOneDay(supabase, apiUrl, token, parc.id, albaCode, day);

        totalReceived += res.items_received;
        totalInserted += res.items_inserted;
        totalSkipRating += res.skipRating;
        totalSkipKeywords += res.skipKeywords;
        totalSkipDedup += res.skipDedup;
        totalSkipOther += res.skipOther;

        perDay.push({
          day,
          http_status: res.http_status,
          items_received: res.items_received,
          items_inserted: res.items_inserted,
          ...(res.error ? { error: res.error } : {}),
        });

        if (!firstHttpError && res.http_status !== 200 && res.error) {
          firstHttpError = {
            day,
            http_status: res.http_status,
            error: res.error,
          };
        }

        if (i < jours.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
      }

      const finalStatus = firstHttpError && totalReceived === 0 ? "error" : "success";

      const meta = {
        parc_code: albaCode,
        venue_code_roller: venueKey,
        mode,
        modifiedDate_envoye: startDate,
        range_jours_couverts: `${startDate} -> ${endDate} (${jours.length}j)`,
        items_recus_de_roller: totalReceived,
        items_filtres_par_score: totalSkipRating,
        items_filtres_par_keywords: totalSkipKeywords,
        items_skipped_dedup: totalSkipDedup,
        items_skipped_other: totalSkipOther,
        items_inseres_finalement: totalInserted,
        per_day: perDay,
        ...(firstHttpError ? { first_http_error: firstHttpError } : {}),
      };

      metaParParc[albaCode] = meta;

      await logEnd(supabase, logId, {
        status: finalStatus,
        http_status: firstHttpError?.http_status ?? 200,
        items_received: totalReceived,
        items_inserted: totalInserted,
        items_skipped: totalSkipRating + totalSkipKeywords + totalSkipDedup + totalSkipOther,
        error_message: firstHttpError?.error ?? null,
        meta,
      });

      totaux.total_received += totalReceived;
      totaux.total_inserted += totalInserted;
      totaux.total_skipped_dedup += totalSkipDedup;
      totaux.total_skipped_rating += totalSkipRating;
      totaux.total_skipped_keywords += totalSkipKeywords;
      totaux.total_skipped_other += totalSkipOther;
    }

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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
