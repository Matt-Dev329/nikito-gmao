import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MOTS_PROBLEME = [
  "panne",
  "en panne",
  "casse",
  "cassee",
  "defaillance",
  "defaillant",
  "defectueuse",
  "defectueux",
  "hors service",
  "hs",
  "marche pas",
  "fonctionne pas",
  "ne marche plus",
  "ne fonctionne plus",
  "dysfonctionnement",
  "probleme technique",
  "probleme materiel",
  "souci technique",
  "bloque",
  "bloquee",
  "coince",
  "coincee",
  "arrete",
  "coupe",
  "eteint",
  "abime",
  "abimee",
  "use",
  "usee",
  "dechire",
  "dechiree",
  "troue",
  "trouee",
  "fissure",
  "fissuree",
  "fendu",
  "raye",
  "cabosse",
  "tordu",
  "rouille",
  "decolle",
  "detache",
  "arrache",
  "bancal",
  "branlant",
  "instable",
  "desserre",
  "devisse",
  "perce",
  "creve",
  "eclate",
  "degrade",
  "delabre",
  "vetuste",
  "dangereux",
  "dangereuse",
  "danger",
  "blesse",
  "blessee",
  "blessure",
  "coupure",
  "brulure",
  "chute",
  "tombe",
  "glisse",
  "glissant",
  "pas securise",
  "pas aux normes",
  "tranchant",
  "vis qui depasse",
  "echarde",
  "sale",
  "salete",
  "degueulasse",
  "degoutant",
  "crade",
  "crasseux",
  "pas propre",
  "pas nettoye",
  "mal entretenu",
  "moisissure",
  "moisi",
  "odeur",
  "pue",
  "puanteur",
  "vomi",
  "poisseux",
  "collant",
  "fuite",
  "bouche",
  "bouchee",
  "inonde",
  "coule",
  "flaque",
  "mouille",
  "pas de papier",
  "pas de savon",
  "sombre",
  "pas eclaire",
  "mal eclaire",
  "clignote",
  "gresille",
  "trop chaud",
  "trop froid",
  "etouffant",
  "pas de clim",
  "pas de chauffage",
  "craque",
  "grincement",
  "grince",
  "couine",
  "trou dans le sol",
  "dalle cassee",
  "sol glissant",
  "inadmissible",
  "inacceptable",
  "scandaleux",
  "catastrophique",
  "honteux",
  "remboursement",
  "rembourser",
  "plus jamais",
  "derniere fois",
];

const MOTS_EQUIPEMENT = [
  "trampoline",
  "trampo",
  "ressort",
  "mousse",
  "filet",
  "tapis",
  "matelas",
  "toboggan",
  "laser",
  "laser game",
  "blaster",
  "gilet",
  "pistolet",
  "cible",
  "bowling",
  "piste",
  "quille",
  "boule",
  "karting",
  "kart",
  "volant",
  "pedale",
  "frein",
  "accelerateur",
  "pneu",
  "arcade",
  "borne",
  "manette",
  "ecran",
  "joystick",
  "bouton",
  "mini golf",
  "minigolf",
  "putter",
  "balle",
  "prison island",
  "prison",
  "cadenas",
  "salle",
  "porte",
  "aire de jeux",
  "plaine de jeux",
  "soft play",
  "structure",
  "gonflable",
  "ninja",
  "parcours",
  "escalade",
  "karaoke",
  "micro",
  "enceinte",
  "haut-parleur",
  "realite virtuelle",
  "casque vr",
  "vr",
  "flechette",
  "hache",
  "lancer",
  "toilette",
  "toilettes",
  "wc",
  "sanitaire",
  "chaise",
  "table",
  "banc",
  "casier",
  "vestiaire",
  "climatisation",
  "clim",
  "chauffage",
  "ventilation",
  "lumiere",
  "eclairage",
  "neon",
  "ampoule",
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function estPlainteMaintenance(commentaire: string, rating: number): boolean {
  const texte = normalizeText(commentaire);
  const aProbleme = MOTS_PROBLEME.some((mot) => texte.includes(mot));
  if (!aProbleme) return false;
  if (rating === 1) return true;
  const aEquipement = MOTS_EQUIPEMENT.some((mot) => texte.includes(mot));
  return aEquipement;
}

function detecterPriorite(rating: number): string {
  if (rating === 1) return "critique";
  if (rating === 2) return "haute";
  return "normale";
}

function detecterParc(venueName: string): string {
  const v = venueName.toLowerCase();
  if (v.includes("alfortville") || v.includes("alf")) return "ALF";
  if (v.includes("franconville") || v.includes("fra")) return "FRA";
  if (
    v.includes("genevieve") ||
    v.includes("sgb") ||
    v.includes("ste ge") ||
    v.includes("sainte")
  )
    return "SGB";
  if (
    v.includes("rosny") ||
    v.includes("domus") ||
    v.includes("dom") ||
    v.includes("ros")
  )
    return "DOM";
  return "DOM";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID");
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET");
    const apiUrl = Deno.env.get("ROLLER_API_URL") || "https://api.roller.app";

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error:
            "Secrets ROLLER_CLIENT_ID et ROLLER_CLIENT_SECRET manquants",
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
      return new Response(
        JSON.stringify({
          error: "Auth Roller echouee",
          detail: await tokenRes.text(),
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = (await tokenRes.json()).access_token;

    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    const dateStr = hier.toISOString().split("T")[0];

    const gxsRes = await fetch(
      `${apiUrl}/reporting/gxs?startDate=${dateStr}&endDate=${dateStr}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json;charset=UTF-8",
        },
      },
    );

    if (!gxsRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Erreur API Roller GXS",
          detail: await gxsRes.text(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gxsData = await gxsRes.json();
    const reponses: any[] = Array.isArray(gxsData)
      ? gxsData
      : gxsData.data || [];

    const plaintesDetectees = reponses.filter((r: any) => {
      const rating = r.rating || r.overallRating || r.score || 0;
      if (rating > 3) return false;
      const commentaire = r.comment || r.feedback || r.text || "";
      if (!commentaire) return false;
      return estPlainteMaintenance(commentaire, rating);
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let insertCount = 0;
    let skipCount = 0;

    for (const r of plaintesDetectees) {
      const rollerId = String(
        r.id ||
          r.responseId ||
          r.surveyId ||
          `gxs_${dateStr}_${Math.random().toString(36).slice(2)}`,
      );

      const { data: existing } = await supabase
        .from("plaintes_clients")
        .select("id")
        .eq("source_externe_id", rollerId)
        .limit(1);

      if (existing && existing.length > 0) {
        skipCount++;
        continue;
      }

      const venueName =
        r.venueName || r.venue || r.location || r.locationName || "";
      const parcCode = detecterParc(venueName);
      const { data: parcData } = await supabase
        .from("parcs")
        .select("id")
        .eq("code", parcCode)
        .maybeSingle();

      if (!parcData?.id) {
        skipCount++;
        continue;
      }

      const commentaire = r.comment || r.feedback || r.text || "";
      const rating = r.rating || r.overallRating || r.score || 0;

      await supabase.from("plaintes_clients").insert({
        parc_id: parcData.id,
        source: "roller_gxs",
        source_externe_id: rollerId,
        client_nom:
          r.customerName || r.name || r.guestName || "Client anonyme",
        client_email: r.customerEmail || r.email || r.guestEmail || null,
        client_telephone: r.customerPhone || r.phone || r.guestPhone || null,
        date_visite: r.visitDate || r.date || r.bookingDate || dateStr,
        note_globale: rating,
        commentaire: commentaire,
        categorie: "maintenance",
        statut: "a_qualifier",
        priorite: detecterPriorite(rating),
        est_formation: false,
      });

      insertCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        date_sync: dateStr,
        total_gxs: reponses.length,
        critics_detectes: plaintesDetectees.length,
        inserees: insertCount,
        deja_importees: skipCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[GXS] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
