// ============================================================
// Types métier dérivés du schéma 01_supabase_schema.sql
// Pour la version finale, générer via:
//   npx supabase gen types typescript --project-id XXX > src/types/database.ts
// En attendant, voici les types essentiels typés à la main.
// ============================================================

export type EtatControleItem = 'ok' | 'degrade' | 'hs';
export type StatutIncident = 'ouvert' | 'assigne' | 'en_cours' | 'resolu' | 'ferme' | 'annule';
export type StatutControle = 'a_faire' | 'en_cours' | 'valide' | 'echec' | 'remplace';
export type TypeControle = 'quotidien' | 'hebdo' | 'mensuel';
export type Statut5Pourquoi = 'ouvert' | 'valide' | 'audit_en_cours' | 'clos';
export type AuditResultat = 'efficace' | 'inefficace' | 'partiel';
export type TypeMaintenance =
  | 'preventif_systematique'
  | 'preventif_conditionnel'
  | 'preventif_previsionnel'
  | 'correctif_palliatif'
  | 'correctif_curatif'
  | 'reglementaire'
  | 'amelioration'
  | 'travaux_neufs';
export type CanalPlainte = 'caisse' | 'google_review' | 'email' | 'tel' | 'app_client';
export type Criticite = 'bloquant' | 'majeur' | 'mineur';
export type RoleUtilisateur =
  | 'direction'
  | 'chef_maintenance'
  | 'manager_parc'
  | 'technicien'
  | 'staff_operationnel';
export type AuthMode = 'email_password' | 'pin_seul';
export type StatutValidation = 'en_attente' | 'valide' | 'refuse' | 'desactive';
export type CategorieNoteChantier =
  | 'chantier_initial'
  | 'travaux'
  | 'audit'
  | 'reunion_fournisseur'
  | 'reglementaire'
  | 'autre';

export interface Invitation {
  id: string;
  token: string;
  email: string | null;
  prenom: string;
  nom: string;
  role_id: string;
  parcs_assignes: string[];
  est_manager: boolean;
  auth_mode: AuthMode;
  invite_par_id: string;
  invite_le: string;
  expire_le: string;
  utilise_le: string | null;
  notes: string | null;
}

export interface NoteChantier {
  id: string;
  parc_id: string;
  date_reunion: string;
  categorie: CategorieNoteChantier;
  titre: string;
  participants: string[];
  contenu_md: string;
  decisions: string[];
  pieces_jointes: Array<{ url: string; nom: string; taille: number }>;
  tags: string[];
  cree_par_id: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface Parc {
  id: string;
  code: 'FRA' | 'SGB' | 'DOM' | 'ALF';
  nom: string;
  adresse: string;
  ville: string;
  code_postal: string;
  latitude: number;
  longitude: number;
  surface_m2: number | null;
  ouvert_7j7: boolean;
  actif: boolean;
}

export type StatutEquipement = 'actif' | 'maintenance' | 'hors_service' | 'archive';

export interface Equipement {
  id: string;
  parc_id: string;
  zone_id: string | null;
  categorie_id: string;
  code: string;
  libelle: string;
  numero_serie: string | null;
  date_mise_service: string | null;
  date_fin_garantie: string | null;
  statut: StatutEquipement;
  a_surveiller: boolean;
  meta: Record<string, unknown>;
  cree_le: string;
  modifie_le: string;
}

export interface EquipementAvecJoins extends Equipement {
  parcs: { code: string; nom: string } | null;
  categories_equipement: { nom: string; criticite_defaut: string | null } | null;
  zones: { nom: string } | null;
}

export interface CategorieEquipement {
  id: string;
  nom: string;
  description: string | null;
  criticite_defaut: string | null;
  norme_associee: string | null;
  fournisseur_principal_id: string | null;
  cree_le: string;
}

export interface Zone {
  id: string;
  parc_id: string;
  nom: string;
  ordre: number;
  coordonnees_plan: unknown;
  cree_le: string;
}

export type AssigneA = 'staff' | 'tech';

export interface PointBibliotheque {
  id: string;
  categorie_id: string;
  libelle: string;
  description: string | null;
  type_controle: TypeControle;
  assigne_a: AssigneA;
  obligation_constructeur: boolean;
  norme_associee: string | null;
  bloquant_si_ko: boolean;
  photo_obligatoire: boolean;
  ordre: number;
  verrouille: boolean;
  actif: boolean;
  cree_le: string;
  modifie_le: string;
}

export interface PointBibliothequeAvecJoins extends PointBibliotheque {
  categories_equipement: { id: string; nom: string } | null;
}

export interface Incident {
  id: string;
  numero_bt: string;
  equipement_id: string;
  declare_par: string;
  declare_le: string;
  priorite_id: string;
  statut: StatutIncident;
  description: string;
  resolu_le: string | null;
}

export interface Intervention {
  id: string;
  incident_id: string;
  technicien_id: string;
  debut: string;
  fin: string | null;
  diagnostic: string | null;
  actions: string | null;
  resolu_premier_coup: boolean | null;
}

export interface Fiche5Pourquoi {
  id: string;
  incident_id: string;
  equipement_id: string;
  ouvert_par_id: string;
  ouvert_le: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  q4: string | null;
  q5: string | null;
  cause_racine: string | null;
  contre_mesure: string | null;
  type_action: TypeMaintenance | null;
  validee_par_id: string | null;
  validee_le: string | null;
  audit_90j_le: string | null;
  audit_resultat: AuditResultat | null;
  statut: Statut5Pourquoi;
  cree_le: string;
  modifie_le: string;
}

export interface Fiche5PourquoiAvecJoins extends Fiche5Pourquoi {
  equipements: { code: string; libelle: string; parc_id: string; parcs: { code: string; nom: string } | null } | null;
  incidents: { numero_bt: string; titre: string } | null;
}

export interface PieceDetachee {
  id: string;
  reference: string;
  nom: string;
  description: string | null;
  fournisseur_id: string | null;
  stock_actuel: number;
  stock_min: number;
  prix_unitaire_ht: number | null;
  delai_reappro_jours: number | null;
  emplacement: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface PieceDetacheeAvecJoins extends PieceDetachee {
  fournisseurs: { nom: string; contact_tel: string | null } | null;
}

export interface MaintenancePreventive {
  id: string;
  equipement_id: string;
  type: TypeMaintenance;
  libelle: string;
  description: string | null;
  frequence_jours: number | null;
  derniere_execution: string | null;
  prochaine_echeance: string;
  duree_min_estimee: number | null;
  fournisseur_id: string | null;
  actif: boolean;
  cree_le: string;
  modifie_le: string;
}

export interface MaintenancePreventiveAvecJoins extends MaintenancePreventive {
  equipements: { code: string; libelle: string; parc_id: string; parcs: { code: string; nom: string } | null } | null;
  fournisseurs: { nom: string } | null;
}

export interface Certification {
  id: string;
  equipement_id: string;
  norme: string;
  organisme_certificateur: string | null;
  numero_certificat: string | null;
  date_certif: string;
  prochaine_echeance: string;
  document_pdf_url: string | null;
  notes: string | null;
  cree_le: string;
  modifie_le: string;
}

export interface CertificationAvecJoins extends Certification {
  equipements: { code: string; libelle: string; parc_id: string; parcs: { code: string; nom: string } | null } | null;
}

export interface PlainteClient {
  id: string;
  equipement_id: string | null;
  parc_id: string;
  declare_le: string;
  canal: CanalPlainte | null;
  commentaire: string | null;
  saisi_par_id: string | null;
  ticket_genere_id: string | null;
  cree_le: string;
}

export interface PlainteClientAvecJoins extends PlainteClient {
  parcs: { code: string; nom: string } | null;
  equipements: { code: string; libelle: string } | null;
  incidents: { numero_bt: string } | null;
}

// Vues KPI
export interface KpiPerformance {
  parc_id: string;
  parc_nom: string;
  performance_pct: number;
}
export interface KpiMtbf {
  parc_id: string;
  mtbf_jours: number;
}
export interface KpiMttr {
  parc_id: string;
  mttr_minutes: number;
}
export interface KpiPremierCoup {
  parc_id: string;
  premier_coup_pct: number;
}
export interface KpiPlaintes {
  parc_id: string;
  plaintes_7j: number;
}
export interface RecurrenceActive {
  equipement_id: string;
  code: string;
  libelle: string;
  parc_id: string;
  parc_nom: string;
  pannes_30j: number;
  pannes_90j: number;
  plaintes_7j: number;
  a_surveiller: boolean;
  a_5_pourquoi: boolean;
}

// Database stub for supabase-js typing
// (à remplacer par le fichier généré par `supabase gen types`)
export interface Database {
  public: {
    Tables: {
      parcs: { Row: Parc; Insert: Omit<Parc, 'id'>; Update: Partial<Parc> };
      equipements: { Row: Equipement; Insert: Omit<Equipement, 'id'>; Update: Partial<Equipement> };
      incidents: { Row: Incident; Insert: Omit<Incident, 'id' | 'numero_bt'>; Update: Partial<Incident> };
      interventions: { Row: Intervention; Insert: Omit<Intervention, 'id'>; Update: Partial<Intervention> };
    };
    Views: {
      vue_kpi_performance: { Row: KpiPerformance };
      vue_kpi_mtbf: { Row: KpiMtbf };
      vue_kpi_mttr: { Row: KpiMttr };
      vue_kpi_premier_coup: { Row: KpiPremierCoup };
      vue_kpi_plaintes: { Row: KpiPlaintes };
      vue_recurrences_actives: { Row: RecurrenceActive };
    };
  };
}
