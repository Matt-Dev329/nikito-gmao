/**
 * Formulaire d'accident (déclaration de blessé) : choix repris du formulaire
 * Microsoft Forms Nikito — parc & activité, emplacements par activité.
 */

/** Hors activité : accueil, bar, vestiaires… et cas non listés */
const ACTIVITES_COMMUNES = ['Espaces communs (accueil, bar, vestiaires, escaliers…)', 'Autre'];

/**
 * Activités proposées par parc (question « Choix du parc & activité ») :
 * toutes les activités ouvertes au public présentes dans le parc (équipements
 * ALBA), puis les espaces communs.
 */
export const ACTIVITES_PAR_PARC: Record<string, string[]> = {
  ALF: ['Trampoline', 'Laser Game', 'SoftPlay', 'Château gonflable', 'Palomano', 'Arcade', ...ACTIVITES_COMMUNES],
  FRA: ['Trampoline', 'Ninja parcours', 'Laser Game', 'SoftPlay', 'Arcade', ...ACTIVITES_COMMUNES],
  DOM: [
    'Trampoline', 'Prison Island', 'Karting', 'Laser Game', 'Bowling', 'Mini-golf', 'Lancer de haches',
    'Fléchettes AR', 'Octogone', 'Réalité virtuelle', 'Karaoké', 'I-Quiz', 'SoftPlay', 'Château gonflable', 'Arcade',
    ...ACTIVITES_COMMUNES,
  ],
  SGB: [
    'Trampoline', 'Prison Island', 'Karting', 'Laser Game', 'Bowling', 'Mini-golf', 'Lancer de haches',
    'Fléchettes AR', 'Octogone', 'SoftPlay', 'Château gonflable', 'Arcade',
    ...ACTIVITES_COMMUNES,
  ],
};

const ZONES_TRAMPO = [
  'Zone 1 : Zone Parkour',
  'Zone 2 : Zone trampoline',
  'Zone 3 : Basket',
  'Zone 4 : Pousse-pousse',
  'Zone 5 : Parcours Ninja Warrior',
  'Zone 6 : Toboggan',
  'Zone 7 : Saut',
  'Zone 8 : Labyrinthe',
];

const SALLES_PRISON_ISLAND = [
  'La chasse', 'Einstein', 'Splash', 'Musique', 'Laser gun', 'Les daltoniens', 'Prison', 'Les visiteurs',
  "L'hôtel", 'Maps', 'Pente Glissante', 'Pyramide', 'Les portes', 'Joker', 'Roof top', 'Copy cat',
  'Haut tension', 'Code sources', 'La cage', 'Hitman', 'Musculation', 'Coffre-fort', 'Jugement',
  'Studio 21', 'Sous-marin', 'Emeute', 'Tilt', 'Pénalty', "Chute d'eau", 'Dock', 'Basket', 'La tour',
  'Jeux de la taupe', 'Le nid', 'Cliffenger',
].map((nom, i) => `Salle ${i + 1} : ${nom}`);

/** Emplacements par « parc|activité ». Absent = emplacement en texte libre. */
export const EMPLACEMENTS: Record<string, string[]> = {
  'ALF|Trampoline': [
    'Main tramp (zone 1)',
    'Airbag central (zone 2)',
    'Rouleau (zone 2)',
    'Ninja (zone 3)',
    'Wall tramp (zone 3)',
    'Trapèze (zone 3)',
    'Toboggan (zone 3)',
    "Mur d'escalade (zone 4)",
    'Softplay Labyrinthe',
  ],
  'DOM|Karting': [
    'Virage 1 (Bas de la montée)',
    'Virage 2 (Haut de la montée)',
    'Virage 3 (Virage et 1er étage)',
    'Virage 4 (Virage de la descente en haut)',
    'Virage 5 (Descente et virage bas)',
    'Virage 6 (Virage RDC sous structure)',
    'Virage 7 (Virage RDC arrivée)',
    'Virage 8 (Virage départ)',
  ],
  'DOM|Trampoline': ZONES_TRAMPO,
  'SGB|Trampoline': ZONES_TRAMPO,
  'DOM|Prison Island': SALLES_PRISON_ISLAND,
  'SGB|Prison Island': SALLES_PRISON_ISLAND,
};

export const NIVEAUX_BLESSURE = [
  { niveau: 1, titre: 'Niveau 1', detail: 'Blessure mineure et passagère (maux de tête, petite foulure, petit choc…)' },
  { niveau: 2, titre: 'Niveau 2', detail: 'Blessure modérée qui ne nécessite pas l’intervention des secouristes (petite entorse, saignement léger…)' },
  { niveau: 3, titre: 'Niveau 3', detail: 'Blessure importante : avis médical et/ou intervention des secouristes (fracture, grosse entorse, luxation…)' },
] as const;

/** Registre et déclaration : comptes internes (hors technicien) ; le staff déclare depuis sa tablette */
export const ROLES_BLESSES: string[] = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'admin_it'];

export interface DeclarationBlesse {
  id: string;
  numero: string;
  parc_id: string;
  survenu_le: string;
  peut_se_deplacer: boolean | null;
  victime_nom: string | null;
  victime_prenom: string | null;
  victime_date_naissance: string | null;
  est_mineur: boolean;
  victime_adresse: string | null;
  victime_cp_ville: string | null;
  contact_telephone: string | null;
  niveau: number | null;
  blessure: string | null;
  activite: string | null;
  emplacement: string | null;
  secouristes: boolean | null;
  secouristes_heure: string | null;
  staff_referent: string | null;
  circonstances: string | null;
  manager_informe: boolean | null;
  manager_prenom: string | null;
  declare_par_nom: string | null;
  declare_le: string;
  /** Niveau 3 : appel du client validé (les rappels tous les 3 jours s'arrêtent) */
  client_appele_le?: string | null;
  client_appele_par_nom?: string | null;
  client_appel_note?: string | null;
  parcs?: { code: string; nom: string } | null;
}
