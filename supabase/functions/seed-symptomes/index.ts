import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SymptomeSeed {
  categorie_nom: string;
  libelle: string;
  icone: string;
  ordre: number;
}

const SEED: SymptomeSeed[] = [
  // Arcade · borne
  { categorie_nom: "Arcade · borne", libelle: "Écran noir", icone: "🖥️", ordre: 1 },
  { categorie_nom: "Arcade · borne", libelle: "Ne prend pas la monnaie", icone: "🪙", ordre: 2 },
  { categorie_nom: "Arcade · borne", libelle: "Son coupé", icone: "🔇", ordre: 3 },
  { categorie_nom: "Arcade · borne", libelle: "Joystick cassé", icone: "🕹️", ordre: 4 },
  { categorie_nom: "Arcade · borne", libelle: "Écran gelé", icone: "❄️", ordre: 5 },
  { categorie_nom: "Arcade · borne", libelle: "Bouton ne répond pas", icone: "🔘", ordre: 6 },
  { categorie_nom: "Arcade · borne", libelle: "Lecteur carte HS", icone: "💳", ordre: 7 },

  // Ascenseur PMR
  { categorie_nom: "Ascenseur PMR", libelle: "Ne démarre pas", icone: "⛔", ordre: 1 },
  { categorie_nom: "Ascenseur PMR", libelle: "Porte bloquée", icone: "🚪", ordre: 2 },
  { categorie_nom: "Ascenseur PMR", libelle: "Alarme déclenchée", icone: "🚨", ordre: 3 },
  { categorie_nom: "Ascenseur PMR", libelle: "Bruit anormal", icone: "🔊", ordre: 4 },
  { categorie_nom: "Ascenseur PMR", libelle: "Éclairage cabine HS", icone: "💡", ordre: 5 },

  // Bowling · piste
  { categorie_nom: "Bowling · piste", libelle: "Quille bloquée", icone: "🎳", ordre: 1 },
  { categorie_nom: "Bowling · piste", libelle: "Retour de boule bloqué", icone: "🔄", ordre: 2 },
  { categorie_nom: "Bowling · piste", libelle: "Machine ne relève plus", icone: "⚙️", ordre: 3 },
  { categorie_nom: "Bowling · piste", libelle: "Écran score HS", icone: "📺", ordre: 4 },
  { categorie_nom: "Bowling · piste", libelle: "Gouttière bloquée", icone: "🛡️", ordre: 5 },
  { categorie_nom: "Bowling · piste", libelle: "Piste glissante anormale", icone: "⚠️", ordre: 6 },

  // Casier
  { categorie_nom: "Casier", libelle: "Porte bloquée", icone: "🚪", ordre: 1 },
  { categorie_nom: "Casier", libelle: "Serrure cassée", icone: "🔒", ordre: 2 },
  { categorie_nom: "Casier", libelle: "Clé perdue / manquante", icone: "🔑", ordre: 3 },

  // Château gonflable
  { categorie_nom: "Château gonflable", libelle: "Dégonflé / fuite air", icone: "💨", ordre: 1 },
  { categorie_nom: "Château gonflable", libelle: "Déchirure toile", icone: "🪡", ordre: 2 },
  { categorie_nom: "Château gonflable", libelle: "Soufflerie HS", icone: "🌀", ordre: 3 },
  { categorie_nom: "Château gonflable", libelle: "Point d'ancrage lâche", icone: "⚓", ordre: 4 },

  // Éclairage parc
  { categorie_nom: "Éclairage parc", libelle: "Ampoule grillée", icone: "💡", ordre: 1 },
  { categorie_nom: "Éclairage parc", libelle: "Zone non éclairée", icone: "🌑", ordre: 2 },
  { categorie_nom: "Éclairage parc", libelle: "Éclairage clignote", icone: "✨", ordre: 3 },
  { categorie_nom: "Éclairage parc", libelle: "Projecteur mal orienté", icone: "🔦", ordre: 4 },

  // Escalator
  { categorie_nom: "Escalator", libelle: "Arrêt complet", icone: "⛔", ordre: 1 },
  { categorie_nom: "Escalator", libelle: "Bruit anormal", icone: "🔊", ordre: 2 },
  { categorie_nom: "Escalator", libelle: "Marche manquante / abîmée", icone: "🪜", ordre: 3 },
  { categorie_nom: "Escalator", libelle: "Main courante bloquée", icone: "🤚", ordre: 4 },

  // Fléchettes AR · poste
  { categorie_nom: "Fléchettes AR · poste", libelle: "Écran ne répond pas", icone: "🖥️", ordre: 1 },
  { categorie_nom: "Fléchettes AR · poste", libelle: "Caméra HS", icone: "📷", ordre: 2 },
  { categorie_nom: "Fléchettes AR · poste", libelle: "Fléchette manquante", icone: "🎯", ordre: 3 },

  // I-Quiz · pupitre
  { categorie_nom: "I-Quiz · pupitre", libelle: "Écran tactile HS", icone: "🖥️", ordre: 1 },
  { categorie_nom: "I-Quiz · pupitre", libelle: "Son coupé", icone: "🔇", ordre: 2 },
  { categorie_nom: "I-Quiz · pupitre", libelle: "Ne s'allume pas", icone: "⛔", ordre: 3 },

  // Immersive VR · salle
  { categorie_nom: "Immersive VR · salle", libelle: "Casque HS", icone: "🥽", ordre: 1 },
  { categorie_nom: "Immersive VR · salle", libelle: "Manette cassée", icone: "🎮", ordre: 2 },
  { categorie_nom: "Immersive VR · salle", libelle: "Tracking perdu", icone: "📡", ordre: 3 },
  { categorie_nom: "Immersive VR · salle", libelle: "PC ne démarre pas", icone: "💻", ordre: 4 },

  // Karaoké · salle
  { categorie_nom: "Karaoké · salle", libelle: "Micro HS", icone: "🎤", ordre: 1 },
  { categorie_nom: "Karaoké · salle", libelle: "Écran ne s'affiche pas", icone: "📺", ordre: 2 },
  { categorie_nom: "Karaoké · salle", libelle: "Son grésille", icone: "🔊", ordre: 3 },
  { categorie_nom: "Karaoké · salle", libelle: "Télécommande HS", icone: "📱", ordre: 4 },

  // Karting · borne recharge
  { categorie_nom: "Karting · borne recharge", libelle: "Ne charge pas", icone: "🔌", ordre: 1 },
  { categorie_nom: "Karting · borne recharge", libelle: "Voyant erreur", icone: "🚨", ordre: 2 },
  { categorie_nom: "Karting · borne recharge", libelle: "Câble endommagé", icone: "🔗", ordre: 3 },

  // Karting · kart
  { categorie_nom: "Karting · kart", libelle: "Ne démarre pas", icone: "⛔", ordre: 1 },
  { categorie_nom: "Karting · kart", libelle: "Batterie à plat", icone: "🔋", ordre: 2 },
  { categorie_nom: "Karting · kart", libelle: "Pneu crevé", icone: "🛞", ordre: 3 },
  { categorie_nom: "Karting · kart", libelle: "Volant dur", icone: "🎡", ordre: 4 },
  { categorie_nom: "Karting · kart", libelle: "Frein faible", icone: "🛑", ordre: 5 },
  { categorie_nom: "Karting · kart", libelle: "Carrosserie abîmée", icone: "🏎️", ordre: 6 },

  // Lancer haches · cible
  { categorie_nom: "Lancer haches · cible", libelle: "Cible éclatée", icone: "🎯", ordre: 1 },
  { categorie_nom: "Lancer haches · cible", libelle: "Hache abîmée", icone: "🪓", ordre: 2 },
  { categorie_nom: "Lancer haches · cible", libelle: "Grillage de sécurité troué", icone: "🛡️", ordre: 3 },

  // Laser Game · pack
  { categorie_nom: "Laser Game · pack", libelle: "Gilet ne s'allume pas", icone: "🦺", ordre: 1 },
  { categorie_nom: "Laser Game · pack", libelle: "Blaster HS", icone: "🔫", ordre: 2 },
  { categorie_nom: "Laser Game · pack", libelle: "Capteur ne détecte pas", icone: "📡", ordre: 3 },
  { categorie_nom: "Laser Game · pack", libelle: "Sangle cassée", icone: "🔗", ordre: 4 },

  // Mini-golf · trou
  { categorie_nom: "Mini-golf · trou", libelle: "Feutre décollé", icone: "🏌️", ordre: 1 },
  { categorie_nom: "Mini-golf · trou", libelle: "Obstacle cassé", icone: "🧱", ordre: 2 },
  { categorie_nom: "Mini-golf · trou", libelle: "Balle coincée", icone: "⛳", ordre: 3 },
  { categorie_nom: "Mini-golf · trou", libelle: "Bordure décollée", icone: "📐", ordre: 4 },

  // Monte-charge
  { categorie_nom: "Monte-charge", libelle: "Ne démarre pas", icone: "⛔", ordre: 1 },
  { categorie_nom: "Monte-charge", libelle: "Bruit anormal", icone: "🔊", ordre: 2 },
  { categorie_nom: "Monte-charge", libelle: "Porte bloquée", icone: "🚪", ordre: 3 },

  // Ninja · parcours
  { categorie_nom: "Ninja · parcours", libelle: "Prise d'escalade cassée", icone: "🧗", ordre: 1 },
  { categorie_nom: "Ninja · parcours", libelle: "Filet déchiré", icone: "🕸️", ordre: 2 },
  { categorie_nom: "Ninja · parcours", libelle: "Structure qui bouge", icone: "🔩", ordre: 3 },
  { categorie_nom: "Ninja · parcours", libelle: "Matelas déplacé / abîmé", icone: "🛏️", ordre: 4 },

  // Octogone
  { categorie_nom: "Octogone", libelle: "Filet déchiré", icone: "🕸️", ordre: 1 },
  { categorie_nom: "Octogone", libelle: "Structure instable", icone: "🔩", ordre: 2 },
  { categorie_nom: "Octogone", libelle: "Tapis usé", icone: "🟫", ordre: 3 },

  // Palomano
  { categorie_nom: "Palomano", libelle: "Balle percée", icone: "⚽", ordre: 1 },
  { categorie_nom: "Palomano", libelle: "Filet déchiré", icone: "🕸️", ordre: 2 },
  { categorie_nom: "Palomano", libelle: "Cage endommagée", icone: "🥅", ordre: 3 },

  // Prison Island · salle
  { categorie_nom: "Prison Island · salle", libelle: "Cadenas bloqué", icone: "🔒", ordre: 1 },
  { categorie_nom: "Prison Island · salle", libelle: "Écran indice HS", icone: "📺", ordre: 2 },
  { categorie_nom: "Prison Island · salle", libelle: "Porte bloquée", icone: "🚪", ordre: 3 },
  { categorie_nom: "Prison Island · salle", libelle: "Éclairage salle HS", icone: "💡", ordre: 4 },

  // Projecteur DMX
  { categorie_nom: "Projecteur DMX", libelle: "Ne s'allume pas", icone: "⛔", ordre: 1 },
  { categorie_nom: "Projecteur DMX", libelle: "Couleur bloquée", icone: "🎨", ordre: 2 },
  { categorie_nom: "Projecteur DMX", libelle: "Ventilateur bruyant", icone: "🌀", ordre: 3 },

  // Sanitaire bloc
  { categorie_nom: "Sanitaire bloc", libelle: "WC bouché", icone: "🚽", ordre: 1 },
  { categorie_nom: "Sanitaire bloc", libelle: "Fuite d'eau", icone: "💧", ordre: 2 },
  { categorie_nom: "Sanitaire bloc", libelle: "Robinet HS", icone: "🚰", ordre: 3 },
  { categorie_nom: "Sanitaire bloc", libelle: "Porte cassée", icone: "🚪", ordre: 4 },
  { categorie_nom: "Sanitaire bloc", libelle: "Plus de savon / papier", icone: "🧻", ordre: 5 },
  { categorie_nom: "Sanitaire bloc", libelle: "Odeur anormale", icone: "👃", ordre: 6 },

  // Sécurité & Sorties de secours
  { categorie_nom: "Sécurité & Sorties de secours", libelle: "Porte bloquée", icone: "🚪", ordre: 1 },
  { categorie_nom: "Sécurité & Sorties de secours", libelle: "Signalétique HS", icone: "🚧", ordre: 2 },
  { categorie_nom: "Sécurité & Sorties de secours", libelle: "Extincteur manquant", icone: "🧯", ordre: 3 },
  { categorie_nom: "Sécurité & Sorties de secours", libelle: "Alarme déclenchée", icone: "🚨", ordre: 4 },
  { categorie_nom: "Sécurité & Sorties de secours", libelle: "Éclairage secours HS", icone: "💡", ordre: 5 },

  // SoftPlay
  { categorie_nom: "SoftPlay", libelle: "Mousse déchirée", icone: "🧽", ordre: 1 },
  { categorie_nom: "SoftPlay", libelle: "Toboggan abîmé", icone: "🛝", ordre: 2 },
  { categorie_nom: "SoftPlay", libelle: "Filet déchiré", icone: "🕸️", ordre: 3 },
  { categorie_nom: "SoftPlay", libelle: "Piscine à balles sale", icone: "🔴", ordre: 4 },

  // TGBT
  { categorie_nom: "TGBT", libelle: "Disjoncteur déclenché", icone: "⚡", ordre: 1 },
  { categorie_nom: "TGBT", libelle: "Odeur de brûlé", icone: "🔥", ordre: 2 },
  { categorie_nom: "TGBT", libelle: "Bruit anormal", icone: "🔊", ordre: 3 },
  { categorie_nom: "TGBT", libelle: "Voyant erreur", icone: "🚨", ordre: 4 },

  // Trampoline
  { categorie_nom: "Trampoline", libelle: "Toile percée", icone: "🕳️", ordre: 1 },
  { categorie_nom: "Trampoline", libelle: "Ressort cassé", icone: "🔗", ordre: 2 },
  { categorie_nom: "Trampoline", libelle: "Tapis bord déchiré", icone: "🪡", ordre: 3 },
  { categorie_nom: "Trampoline", libelle: "Structure qui vibre", icone: "🔩", ordre: 4 },
  { categorie_nom: "Trampoline", libelle: "Filet de sécurité troué", icone: "🕸️", ordre: 5 },
  { categorie_nom: "Trampoline", libelle: "Mousse de protection usée", icone: "🧽", ordre: 6 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: categories } = await supabase
      .from("categories_equipement")
      .select("id, nom");

    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucune categorie trouvee" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const catMap = new Map(categories.map((c) => [c.nom, c.id]));
    let inserted = 0;
    let skipped = 0;

    for (const s of SEED) {
      const catId = catMap.get(s.categorie_nom);
      if (!catId) {
        console.warn(`Categorie introuvable: ${s.categorie_nom}`);
        skipped++;
        continue;
      }

      const { error } = await supabase.from("symptomes").upsert(
        {
          categorie_id: catId,
          libelle: s.libelle,
          icone: s.icone,
          ordre: s.ordre,
          actif: true,
        },
        { onConflict: "categorie_id,libelle" }
      );

      if (error) {
        console.warn(`Erreur insert ${s.libelle}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }

    // Fallback "Autre (décrire)" for every category
    for (const [nom, catId] of catMap) {
      const { error } = await supabase.from("symptomes").upsert(
        {
          categorie_id: catId,
          libelle: "Autre (décrire)",
          icone: "✏️",
          ordre: 999,
          actif: true,
        },
        { onConflict: "categorie_id,libelle" }
      );

      if (error) {
        console.warn(`Erreur fallback ${nom}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, total_seed: SEED.length, total_categories: categories.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seed-symptomes error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
