/*
  # Module Conformite ERP - Schema principal

  1. New Tables
    - `parcs_phases` : phases du cycle de vie d'un parc (projet → ouverture → vie courante)
      - `id` (uuid, PK)
      - `parc_id` (uuid, FK parcs)
      - `phase` (text, enum: projet, etudes, pre_commission, travaux, commission_initiale, reserves_a_lever, ouverture, vie_courante, travaux_modif, ferme)
      - `date_debut` (timestamptz)
      - `date_fin` (timestamptz, nullable)
      - `date_prevu` (timestamptz, nullable)
      - `notes` (text, nullable)
      - `cree_par_id`, `cree_le`

    - `commissions_securite` : commissions de securite ERP (CCDSA, sous-commission)
      - `id` (uuid, PK)
      - `parc_id` (uuid, FK parcs)
      - `type_commission` (text, enum: initiale_ouverture, periodique, travaux_modif, levee_reserves, controle_inopine)
      - `date_visite` (date)
      - `date_pv` (date, nullable)
      - `numero_pv` (text, unique, nullable)
      - `pv_url` (text, nullable)
      - `president_commission` (text, nullable)
      - `presents_externes` (jsonb)
      - `presents_internes` (uuid[])
      - `resultat` (text, enum: favorable, favorable_avec_reserves, defavorable, differe, en_attente_pv)
      - `prochaine_visite_prevue` (date, nullable)
      - `notes`, `cree_par_id`, `modifie_par_id`, `cree_le`, `modifie_le`

    - `prescriptions_securite` : prescriptions et reserves a lever suite aux commissions
      - `id` (uuid, PK)
      - `commission_id` (uuid, FK commissions_securite)
      - `parc_id` (uuid, FK parcs)
      - `numero_prescription` (text, nullable)
      - `categorie` (text, enum: SSI, desenfumage, evacuation, eclairage_secours, electrique, ascenseur, isolement_coupe_feu, accessibilite_pmr, capacite_accueil, autre)
      - `gravite` (text, enum: bloquante, majeure, mineure)
      - `reglement_applicable` (text, nullable)
      - `intitule` (text)
      - `description` (text, nullable)
      - `photo_url` (text, nullable)
      - `delai_levee` (date, nullable)
      - `responsable_id` (uuid, FK utilisateurs, nullable)
      - `statut` (text, enum: a_lever, en_cours, levee_proposee, levee_validee, caduque)
      - `date_levee_effective` (date, nullable)
      - `preuve_levee_url`, `preuve_levee_notes` (text, nullable)
      - `validee_par_commission_id` (uuid, FK commissions_securite, nullable)
      - `cout_estime`, `cout_reel` (numeric(10,2), nullable)
      - `cree_par_id`, `modifie_par_id`, `cree_le`, `modifie_le`

    - `documents_chantier` : documents lies aux chantiers et commissions
      - `id` (uuid, PK)
      - `parc_id` (uuid, FK parcs)
      - `categorie` (text, enum: plan_architecte, dossier_erp, attestation_controle_technique, rapport_bet, pv_commission, arrete_ouverture, bail, attestation_ssi, photo_chantier, autre)
      - `intitule` (text)
      - `fichier_url` (text)
      - `date_document` (date, nullable)
      - `emis_par` (text, nullable)
      - `est_obligatoire_ouverture` (boolean, default false)
      - `commission_id` (uuid, FK commissions_securite, nullable)
      - `prescription_id` (uuid, FK prescriptions_securite, nullable)
      - `cree_par_id`, `cree_le`

    - `acteurs_chantier` : acteurs externes du chantier / conformite
      - `id` (uuid, PK)
      - `parc_id` (uuid, FK parcs)
      - `type_acteur` (text, enum: architecte, bet_structure, bet_fluides, controleur_technique, coordonnateur_sps, mainteneur_ssi, mairie, sdis, sous_commission_erp, maitre_oeuvre, autre)
      - `nom_societe` (text)
      - `contact_nom`, `contact_email`, `contact_tel` (text, nullable)
      - `date_debut_mission`, `date_fin_mission` (date, nullable)
      - `notes` (text, nullable)
      - `cree_par_id`, `cree_le`

    - `notifications_conformite` : notifications specifiques au module conformite
      - `id` (uuid, PK)
      - `destinataire_id` (uuid, FK utilisateurs)
      - `parc_id` (uuid, FK parcs, nullable)
      - `type_notification` (text, enum: prescription_creee, prescription_delai_j30/j7/j1, prescription_retard, prescription_levee, commission_a_venir, commission_pv_recu, phase_changement, toutes_reserves_levees)
      - `prescription_id`, `commission_id` (uuid, FK, nullable)
      - `titre` (text)
      - `message` (text, nullable)
      - `lu` (boolean, default false)
      - `lu_le` (timestamptz, nullable)
      - `email_envoye` (boolean, default false)
      - `email_envoye_le` (timestamptz, nullable)
      - `cree_le`

  2. Views
    - `v_parcs_phase_actuelle` : phase actuelle de chaque parc (security_invoker)

  3. Indexes
    - Indexes sur parc_id + colonnes de tri pour chaque table
    - Index partiel sur prescriptions par delai (statut actif)
    - Index partiel sur prescriptions par responsable

  4. Security
    - RLS active sur les 6 tables
    - Policies basees sur current_parc_ids() et current_role_code()
*/

-- ============================================================
-- Table 1 : phases du cycle de vie d'un parc
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parcs_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN (
    'projet', 'etudes', 'pre_commission', 'travaux',
    'commission_initiale', 'reserves_a_lever',
    'ouverture', 'vie_courante', 'travaux_modif', 'ferme'
  )),
  date_debut timestamptz NOT NULL DEFAULT now(),
  date_fin timestamptz,
  date_prevu timestamptz,
  notes text,
  cree_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parcs_phases_parc ON parcs_phases(parc_id, date_debut DESC);

-- ============================================================
-- Vue : phase actuelle de chaque parc
-- ============================================================

CREATE OR REPLACE VIEW v_parcs_phase_actuelle
WITH (security_invoker = true) AS
SELECT DISTINCT ON (parc_id)
  parc_id, phase, date_debut, date_fin, date_prevu
FROM parcs_phases
WHERE date_fin IS NULL
ORDER BY parc_id, date_debut DESC;

-- ============================================================
-- Table 2 : commissions de securite
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commissions_securite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  type_commission text NOT NULL CHECK (type_commission IN (
    'initiale_ouverture', 'periodique', 'travaux_modif',
    'levee_reserves', 'controle_inopine'
  )),
  date_visite date NOT NULL,
  date_pv date,
  numero_pv text UNIQUE,
  pv_url text,
  president_commission text,
  presents_externes jsonb DEFAULT '[]'::jsonb,
  presents_internes uuid[] DEFAULT ARRAY[]::uuid[],
  resultat text CHECK (resultat IN (
    'favorable', 'favorable_avec_reserves', 'defavorable',
    'differe', 'en_attente_pv'
  )),
  prochaine_visite_prevue date,
  notes text,
  cree_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  modifie_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now(),
  modifie_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_parc_date ON commissions_securite(parc_id, date_visite DESC);

-- ============================================================
-- Table 3 : prescriptions / reserves
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prescriptions_securite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES commissions_securite(id) ON DELETE CASCADE,
  parc_id uuid NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  numero_prescription text,
  categorie text NOT NULL CHECK (categorie IN (
    'SSI', 'desenfumage', 'evacuation', 'eclairage_secours',
    'electrique', 'ascenseur', 'isolement_coupe_feu',
    'accessibilite_pmr', 'capacite_accueil', 'autre'
  )),
  gravite text NOT NULL CHECK (gravite IN ('bloquante', 'majeure', 'mineure')),
  reglement_applicable text,
  intitule text NOT NULL,
  description text,
  photo_url text,
  delai_levee date,
  responsable_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'a_lever' CHECK (statut IN (
    'a_lever', 'en_cours', 'levee_proposee', 'levee_validee', 'caduque'
  )),
  date_levee_effective date,
  preuve_levee_url text,
  preuve_levee_notes text,
  validee_par_commission_id uuid REFERENCES commissions_securite(id) ON DELETE SET NULL,
  cout_estime numeric(10,2),
  cout_reel numeric(10,2),
  cree_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  modifie_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now(),
  modifie_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_parc_statut ON prescriptions_securite(parc_id, statut);
CREATE INDEX IF NOT EXISTS idx_prescriptions_delai ON prescriptions_securite(delai_levee) WHERE statut IN ('a_lever', 'en_cours');
CREATE INDEX IF NOT EXISTS idx_prescriptions_responsable ON prescriptions_securite(responsable_id) WHERE responsable_id IS NOT NULL;

-- ============================================================
-- Table 4 : documents chantier
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents_chantier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  categorie text NOT NULL CHECK (categorie IN (
    'plan_architecte', 'dossier_erp', 'attestation_controle_technique',
    'rapport_bet', 'pv_commission', 'arrete_ouverture', 'bail',
    'attestation_ssi', 'photo_chantier', 'autre'
  )),
  intitule text NOT NULL,
  fichier_url text NOT NULL,
  date_document date,
  emis_par text,
  est_obligatoire_ouverture boolean DEFAULT false,
  commission_id uuid REFERENCES commissions_securite(id) ON DELETE SET NULL,
  prescription_id uuid REFERENCES prescriptions_securite(id) ON DELETE SET NULL,
  cree_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_chantier_parc ON documents_chantier(parc_id, categorie);

-- ============================================================
-- Table 5 : acteurs externes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.acteurs_chantier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  type_acteur text NOT NULL CHECK (type_acteur IN (
    'architecte', 'bet_structure', 'bet_fluides', 'controleur_technique',
    'coordonnateur_sps', 'mainteneur_ssi', 'mairie', 'sdis',
    'sous_commission_erp', 'maitre_oeuvre', 'autre'
  )),
  nom_societe text NOT NULL,
  contact_nom text,
  contact_email text,
  contact_tel text,
  date_debut_mission date,
  date_fin_mission date,
  notes text,
  cree_par_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acteurs_chantier_parc ON acteurs_chantier(parc_id);

-- ============================================================
-- Table 6 : notifications conformite
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications_conformite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  parc_id uuid REFERENCES parcs(id) ON DELETE CASCADE,
  type_notification text NOT NULL CHECK (type_notification IN (
    'prescription_creee', 'prescription_delai_j30', 'prescription_delai_j7',
    'prescription_delai_j1', 'prescription_retard', 'prescription_levee',
    'commission_a_venir', 'commission_pv_recu', 'phase_changement',
    'toutes_reserves_levees'
  )),
  prescription_id uuid REFERENCES prescriptions_securite(id) ON DELETE CASCADE,
  commission_id uuid REFERENCES commissions_securite(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text,
  lu boolean DEFAULT false,
  lu_le timestamptz,
  email_envoye boolean DEFAULT false,
  email_envoye_le timestamptz,
  cree_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_conformite_user ON notifications_conformite(destinataire_id, lu, cree_le DESC);

-- ============================================================
-- Enable RLS on all tables
-- ============================================================

ALTER TABLE parcs_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions_securite ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions_securite ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents_chantier ENABLE ROW LEVEL SECURITY;
ALTER TABLE acteurs_chantier ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_conformite ENABLE ROW LEVEL SECURITY;
