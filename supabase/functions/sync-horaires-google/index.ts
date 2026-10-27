import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Horaires des parcs calés sur Google (fiche Google Maps de chaque parc),
 * via l'API Google Places (clé GOOGLE_PLACES_API_KEY dans les secrets).
 * - fiche Google trouvée une fois par son nom (parcs.meta.nom_google, ex.
 *   « Nikito SGDB », sinon « Nikito <ville> »), puis gardée dans
 *   parcs.google_place_id ;
 * - horaires de la semaine (regularOpeningHours) recopiés dans
 *   parcs.horaires, jour par jour ; les horaires « vacances » restent ceux
 *   d'ALBA.
 * Appelée chaque matin par pg_cron, ou à la demande (chef d'équipe,
 * direction, admin IT). Une synchronisation au plus par heure.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
type Jour = (typeof JOURS)[number];
interface HoraireJour {
  ouverture: string | null;
  fermeture: string | null;
  ferme: boolean;
}
interface Point {
  day: number;
  hour?: number;
  minute?: number;
}
interface Periode {
  open: Point;
  close?: Point;
}

const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const heure = (p: Point) => `${String(p.hour ?? 0).padStart(2, "0")}:${String(p.minute ?? 0).padStart(2, "0")}`;
// Minutes depuis l'ouverture du jour (une fermeture le lendemain compte après minuit)
const minutes = (p: Point, jourOuverture: number) => ((p.day - jourOuverture + 7) % 7) * 1440 + (p.hour ?? 0) * 60 + (p.minute ?? 0);

/** Horaires Google (périodes) → horaires ALBA, jour par jour */
function versHoraires(periodes: Periode[]): Record<Jour, HoraireJour> {
  const h = Object.fromEntries(JOURS.map((j) => [j, { ouverture: null, fermeture: null, ferme: true }])) as Record<Jour, HoraireJour>;
  // Ouvert 24 h/24, 7 j/7 : une seule période sans fermeture
  if (periodes.length === 1 && !periodes[0].close) {
    JOURS.forEach((j) => (h[j] = { ouverture: "00:00", fermeture: "00:00", ferme: false }));
    return h;
  }
  const parJour = new Map<number, Periode[]>();
  periodes.forEach((p) => parJour.set(p.open.day, [...(parJour.get(p.open.day) ?? []), p]));
  for (const [jour, liste] of parJour) {
    // Plusieurs créneaux le même jour : de la première ouverture à la dernière fermeture
    const premiere = liste.reduce((a, b) => (minutes(b.open, jour) < minutes(a.open, jour) ? b : a));
    const derniere = liste.reduce((a, b) =>
      minutes(b.close ?? b.open, jour) > minutes(a.close ?? a.open, jour) ? b : a
    );
    h[JOURS[jour]] = {
      ouverture: heure(premiere.open),
      fermeture: derniere.close ? heure(derniere.close) : "00:00",
      ferme: false,
    };
  }
  return h;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // Appel d'un utilisateur : réservé au chef d'équipe, à la direction et à l'admin IT
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await service.auth.getUser(jeton);
    const corps = await req.json().catch(() => ({}));
    const force = corps.force === true;
    if (auth?.user) {
      const { data: u } = await service
        .from("utilisateurs")
        .select("roles!inner(code)")
        .eq("auth_user_id", auth.user.id)
        .eq("actif", true)
        .maybeSingle();
      const role = (u?.roles as unknown as { code: string } | null)?.code;
      if (!role || !["chef_maintenance", "direction", "admin_it"].includes(role)) {
        return repondre({ success: false, error: "Accès refusé" }, 403);
      }
    }

    const cle = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!cle) return repondre({ success: false, error: "Clé GOOGLE_PLACES_API_KEY non configurée dans les secrets Supabase" }, 200);

    const { data: parcs, error } = await service
      .from("parcs")
      .select("id, code, nom, ville, adresse, google_place_id, horaires, meta")
      .eq("actif", true)
      .neq("code", "ECO")
      .order("code");
    if (error) throw error;

    const resultats: Record<string, unknown>[] = [];
    for (const parc of parcs ?? []) {
      const meta = (parc.meta ?? {}) as Record<string, unknown>;
      const derniere = meta.horaires_google_le as string | undefined;
      if (!force && derniere && Date.now() - new Date(derniere).getTime() < 3_600_000) {
        resultats.push({ parc: parc.code, statut: "deja_a_jour" });
        continue;
      }

      try {
        // 1. Fiche Google du parc
        let placeId = parc.google_place_id as string | null;
        const nomGoogle = (meta.nom_google as string | undefined) ?? `Nikito ${parc.ville}`;
        if (!placeId) {
          const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": cle,
              "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
            },
            body: JSON.stringify({ textQuery: `${nomGoogle}, ${parc.ville}`, languageCode: "fr", regionCode: "FR" }),
          });
          if (!r.ok) throw new Error(`Recherche Google ${r.status} : ${(await r.text()).slice(0, 200)}`);
          const { places } = (await r.json()) as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[] };
          const trouve = (places ?? []).find((p) => /nikito/i.test(p.displayName?.text ?? ""));
          if (!trouve) throw new Error(`Fiche Google introuvable pour « ${nomGoogle} »`);
          placeId = trouve.id;
          await service.from("parcs").update({ google_place_id: placeId }).eq("id", parc.id);
        }

        // 2. Horaires de la semaine
        const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
          headers: { "X-Goog-Api-Key": cle, "X-Goog-FieldMask": "displayName,formattedAddress,regularOpeningHours" },
        });
        if (!r.ok) throw new Error(`Fiche Google ${r.status} : ${(await r.text()).slice(0, 200)}`);
        const fiche = (await r.json()) as {
          displayName?: { text: string };
          formattedAddress?: string;
          regularOpeningHours?: { periods?: Periode[]; weekdayDescriptions?: string[] };
        };
        const periodes = fiche.regularOpeningHours?.periods ?? [];
        if (!periodes.length) throw new Error("Pas d'horaires sur la fiche Google");

        const semaine = versHoraires(periodes);
        const anciens = (parc.horaires ?? {}) as Record<string, unknown>;
        const horaires = { ...semaine, ...(anciens.vacances ? { vacances: anciens.vacances } : {}) };
        const change = JOURS.some((j) => JSON.stringify(anciens[j]) !== JSON.stringify(semaine[j]));

        await service
          .from("parcs")
          .update({
            ...(change ? { horaires } : {}),
            meta: {
              ...meta,
              horaires_google_le: new Date().toISOString(),
              horaires_google_fiche: fiche.displayName?.text ?? null,
              horaires_google_adresse: fiche.formattedAddress ?? null,
              horaires_google_texte: fiche.regularOpeningHours?.weekdayDescriptions ?? null,
              horaires_google_erreur: null,
            },
          })
          .eq("id", parc.id);
        resultats.push({ parc: parc.code, statut: change ? "mis_a_jour" : "inchange", fiche: fiche.displayName?.text });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await service
          .from("parcs")
          .update({ meta: { ...meta, horaires_google_erreur: message, horaires_google_essai_le: new Date().toISOString() } })
          .eq("id", parc.id);
        resultats.push({ parc: parc.code, statut: "erreur", erreur: message });
      }
    }

    return repondre({ success: true, resultats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sync-horaires-google:", message);
    return repondre({ success: false, error: message }, 500);
  }
});
