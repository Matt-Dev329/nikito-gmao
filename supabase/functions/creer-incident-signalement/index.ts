import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Payload {
  parc_id: string;
  equipement_id: string | null;
  categorie_id: string;
  symptome_id: string | null;
  symptome_libre: string | null;
  photo_url: string;
  priorite_escaladee: boolean;
  equipement_manquant_label: string | null;
  declare_par_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: Payload = await req.json();

    if (!body.parc_id || !body.categorie_id || !body.photo_url || !body.declare_par_id) {
      return jsonResponse({ success: false, error: "Champs requis manquants (parc_id, categorie_id, photo_url, declare_par_id)" }, 400);
    }

    // 1. Verify user has access to this parc
    const { data: access } = await supabase
      .from("parcs_utilisateurs")
      .select("id")
      .eq("utilisateur_id", body.declare_par_id)
      .eq("parc_id", body.parc_id)
      .maybeSingle();

    if (!access) {
      return jsonResponse({ success: false, error: "Acces au parc non autorise" }, 403);
    }

    // 2. Get user role to determine validation_manager
    const { data: user } = await supabase
      .from("utilisateurs")
      .select("id, prenom, nom, role_id, roles:role_id(code)")
      .eq("id", body.declare_par_id)
      .maybeSingle();

    const roleCode = (user?.roles as any)?.code ?? "staff_operationnel";
    const needsManagerApproval = roleCode === "staff_operationnel";

    // 3. Determine priorite_id from categorie criticite_defaut
    const { data: categorie } = await supabase
      .from("categories_equipement")
      .select("criticite_defaut")
      .eq("id", body.categorie_id)
      .maybeSingle();

    const criticiteCode = body.priorite_escaladee
      ? "bloquant"
      : (categorie?.criticite_defaut ?? "mineur");

    const { data: priorite } = await supabase
      .from("niveaux_priorite")
      .select("id, code")
      .eq("code", criticiteCode)
      .maybeSingle();

    if (!priorite) {
      return jsonResponse({ success: false, error: "Priorite introuvable" }, 500);
    }

    // 4. Get symptome label
    let symptomeLabel = "Autre";
    if (body.symptome_id) {
      const { data: symptome } = await supabase
        .from("symptomes")
        .select("libelle")
        .eq("id", body.symptome_id)
        .maybeSingle();
      if (symptome) symptomeLabel = symptome.libelle;
    }

    // 5. Build titre
    let titre: string;
    if (body.equipement_id) {
      const { data: equip } = await supabase
        .from("equipements")
        .select("code")
        .eq("id", body.equipement_id)
        .maybeSingle();
      titre = `${equip?.code ?? "?"} — ${symptomeLabel}`;
    } else {
      titre = `${body.equipement_manquant_label ?? "Equipement inconnu"} — ${symptomeLabel}`;
    }

    // 6. INSERT incident — triggers handle numero_bt, notif, recurrence, 5P
    const { data: incident, error: insertErr } = await supabase
      .from("incidents")
      .insert({
        equipement_id: body.equipement_id,
        priorite_id: priorite.id,
        type_maintenance: "correctif_curatif",
        titre,
        description: body.symptome_libre,
        symptome: symptomeLabel,
        source: "staff_caisse",
        declare_par_id: body.declare_par_id,
        photos_urls: [body.photo_url],
        validation_manager: needsManagerApproval ? "en_attente" : "auto",
        meta: {
          via: "tablette_signalement",
          categorie_id: body.categorie_id,
          symptome_id: body.symptome_id,
          priorite_escaladee: body.priorite_escaladee,
          priorite_initiale: categorie?.criticite_defaut ?? "mineur",
          equipement_manquant_saisi: !!body.equipement_manquant_label,
          declarant_role: roleCode,
        },
      })
      .select("id, numero_bt, validation_manager")
      .single();

    if (insertErr) {
      console.error("Insert incident error:", insertErr);
      return jsonResponse({ success: false, error: insertErr.message }, 500);
    }

    return jsonResponse({
      success: true,
      incident_id: incident.id,
      numero_bt: incident.numero_bt,
      priorite_code: priorite.code,
      validation_manager: incident.validation_manager,
    });
  } catch (err) {
    console.error("creer-incident-signalement error:", err);
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});
