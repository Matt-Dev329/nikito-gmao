import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROMPT_EXTRACTION = `Tu analyses un PV (proces-verbal) de commission de securite ERP francaise. Ton role est d'extraire chaque prescription/reserve mentionnee dans ce document.

CONTEXTE REGLEMENTAIRE :
- Une "prescription" ou "reserve" est une obligation a lever (imperative) emise par la commission
- Une "observation" ou "recommandation" n'est PAS une prescription (juste un conseil)
- Concentre-toi UNIQUEMENT sur les prescriptions/reserves obligatoires

CATEGORIES POSSIBLES (utilise UNIQUEMENT ces valeurs) :
- "SSI" : Systeme de Securite Incendie, alarmes, detecteurs
- "desenfumage" : ventilation incendie, exutoires de fumee
- "evacuation" : sorties de secours, degagements, balisage
- "eclairage_secours" : BAES, eclairage de securite
- "electrique" : tableaux electriques, mises a la terre, NF C 15-100
- "ascenseur" : tous equipements d'ascenseur
- "isolement_coupe_feu" : portes coupe-feu, parois
- "accessibilite_pmr" : accessibilite personnes a mobilite reduite
- "capacite_accueil" : effectif, jauges
- "autre" : tout le reste

GRAVITE (utilise UNIQUEMENT ces valeurs) :
- "bloquante" : empeche l'ouverture ou impose fermeture (avis defavorable)
- "majeure" : necessite levee rapide (generalement < 30 jours)
- "mineure" : a corriger sans urgence (generalement < 6 mois)

Pour chaque prescription, retourne ce JSON STRICT (aucun texte avant ou apres) :
{
  "prescriptions": [
    {
      "intitule": "string court (max 80 caracteres)",
      "description": "string complet, 2-3 phrases max",
      "categorie": "une des valeurs ci-dessus",
      "gravite": "bloquante|majeure|mineure",
      "reglement_applicable": "ex: 'ERP type L art. CO 28' ou null si non precise",
      "delai_levee_jours": "nombre de jours depuis aujourd'hui ou null",
      "confiance": "0.0 a 1.0 selon ta certitude que c'est une vraie prescription"
    }
  ],
  "meta": {
    "type_commission_detecte": "initiale_ouverture|periodique|travaux_modif|levee_reserves|controle_inopine|inconnu",
    "resultat_detecte": "favorable|favorable_avec_reserves|defavorable|differe|inconnu",
    "date_visite_detectee": "YYYY-MM-DD ou null",
    "president_commission": "string ou null",
    "observations_count": "nombre d'observations non-prescriptions trouvees"
  }
}

REGLES IMPORTANTES :
- Ne JAMAIS inventer de prescription
- Si tu hesites entre "observation" et "prescription", marque confiance < 0.6
- Si delai non precise : null (pas d'invention)
- Format JSON strict, parsable directement
- Si le document n'est pas un PV de commission ou est illisible : retourner {"prescriptions": [], "meta": {...}} avec observations_count = 0

Reponds UNIQUEMENT avec le JSON, rien d'autre.`;

function extractStoragePath(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(\?|$)/);
  if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  const signedMatch = url.match(/\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
  if (signedMatch) return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

function parseClaudeJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("Reponse Claude non-JSON");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const t0 = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let extractionId: string | null = null;

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configuree" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const commission_id: string | undefined = body.commission_id;
    const document_id: string | undefined = body.document_id;
    const user_id: string | undefined = body.user_id;

    if (!commission_id) {
      return new Response(
        JSON.stringify({ success: false, error: "commission_id requis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let pvUrl: string | null = null;
    let pvFilename: string | null = null;
    let parcId: string | null = null;

    if (document_id) {
      const { data: doc } = await supabase
        .from("documents_chantier")
        .select("fichier_url, intitule, parc_id")
        .eq("id", document_id)
        .maybeSingle();
      if (doc) {
        pvUrl = doc.fichier_url;
        pvFilename = doc.intitule;
        parcId = doc.parc_id;
      }
    }

    if (!pvUrl) {
      const { data: comm } = await supabase
        .from("commissions_securite")
        .select("pv_url, numero_pv, parc_id")
        .eq("id", commission_id)
        .maybeSingle();
      if (!comm) {
        return new Response(
          JSON.stringify({ success: false, error: "Commission introuvable" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pvUrl = comm.pv_url;
      pvFilename = comm.numero_pv ?? "PV";
      parcId = comm.parc_id;
    }

    if (!pvUrl || !parcId) {
      return new Response(
        JSON.stringify({ success: false, error: "PV ou parc introuvable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: extraction, error: extErr } = await supabase
      .from("extractions_pv")
      .insert({
        commission_id,
        document_id: document_id ?? null,
        parc_id: parcId,
        pv_url: pvUrl,
        pv_filename: pvFilename,
        statut: "en_cours",
        cree_par_id: user_id ?? null,
      })
      .select("id")
      .single();

    if (extErr || !extraction) throw new Error(`Creation extraction echouee : ${extErr?.message ?? "unknown"}`);
    extractionId = extraction.id;

    const storagePath = extractStoragePath(pvUrl);
    let pdfBytes: Uint8Array;

    if (storagePath) {
      const { data: file, error: dlErr } = await supabase.storage.from(storagePath.bucket).download(storagePath.path);
      if (dlErr || !file) throw new Error(`Telechargement PDF echoue : ${dlErr?.message ?? "unknown"}`);
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const res = await fetch(pvUrl);
      if (!res.ok) throw new Error(`Fetch PDF echoue : ${res.status}`);
      pdfBytes = new Uint8Array(await res.arrayBuffer());
    }

    const base64 = toBase64(pdfBytes);

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              { type: "text", text: PROMPT_EXTRACTION },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      throw new Error(`Claude API ${claudeRes.status} : ${errBody}`);
    }

    const claudeData = await claudeRes.json();
    const textBlock = Array.isArray(claudeData.content)
      ? claudeData.content.find((c: { type: string }) => c.type === "text")
      : null;
    if (!textBlock?.text) throw new Error("Reponse Claude vide");

    const parsed = parseClaudeJson(textBlock.text) as {
      prescriptions?: Array<{
        intitule: string;
        description?: string;
        categorie?: string;
        gravite?: string;
        reglement_applicable?: string | null;
        delai_levee_jours?: number | null;
        confiance?: number;
      }>;
      meta?: Record<string, unknown>;
    };

    const prescriptions = parsed.prescriptions ?? [];
    const today = new Date();
    const toDelai = (jours: number | null | undefined): string | null => {
      if (jours == null) return null;
      const d = new Date(today);
      d.setDate(d.getDate() + jours);
      return d.toISOString().slice(0, 10);
    };

    const allowedCategories = new Set([
      "SSI", "desenfumage", "evacuation", "eclairage_secours", "electrique",
      "ascenseur", "isolement_coupe_feu", "accessibilite_pmr", "capacite_accueil", "autre",
    ]);
    const allowedGravites = new Set(["bloquante", "majeure", "mineure"]);

    let insertedCount = 0;
    for (const p of prescriptions) {
      if (!p.intitule) continue;
      const categorie = p.categorie && allowedCategories.has(p.categorie) ? p.categorie : "autre";
      const gravite = p.gravite && allowedGravites.has(p.gravite) ? p.gravite : "mineure";
      const confiance = typeof p.confiance === "number"
        ? Math.max(0, Math.min(1, p.confiance))
        : null;

      const { error: insErr } = await supabase.from("prescriptions_securite").insert({
        commission_id,
        parc_id: parcId,
        categorie,
        gravite,
        intitule: p.intitule.slice(0, 200),
        description: p.description ?? null,
        reglement_applicable: p.reglement_applicable ?? null,
        delai_levee: toDelai(p.delai_levee_jours ?? null),
        statut: "brouillon",
        extrait_par_ia: true,
        extraction_id: extractionId,
        confiance_extraction: confiance,
        cree_par_id: user_id ?? null,
      });
      if (!insErr) insertedCount++;
    }

    const dureeMs = Date.now() - t0;
    const cout = +(insertedCount * 0.003 + 0.10).toFixed(4);

    await supabase
      .from("extractions_pv")
      .update({
        statut: insertedCount > 0 ? "reussie" : "reussie",
        nb_prescriptions_extraites: insertedCount,
        raw_response_claude: parsed as unknown as Record<string, unknown>,
        duree_traitement_ms: dureeMs,
        cout_estime: cout,
      })
      .eq("id", extractionId);

    return new Response(
      JSON.stringify({
        success: true,
        extraction_id: extractionId,
        nb_prescriptions: insertedCount,
        meta: parsed.meta ?? {},
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    console.error("extract-pv-prescriptions error:", msg);

    if (extractionId) {
      await supabase
        .from("extractions_pv")
        .update({
          statut: "echec",
          erreur_message: msg,
          duree_traitement_ms: Date.now() - t0,
        })
        .eq("id", extractionId);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Echec extraction", detail: msg, extraction_id: extractionId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
