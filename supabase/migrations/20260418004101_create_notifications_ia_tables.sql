/*
  # Notifications IA Predictive - Tables et politiques

  1. Nouvelles tables
    - `rapports_ia_hebdo`
      - `id` (uuid, clé primaire)
      - `semaine_iso` (text) - Identifiant de la semaine (ex: "2026-W16")
      - `score_sante` (integer) - Score global 0-100
      - `tendance` (text) - stable/amelioration/degradation
      - `donnees_analyse` (jsonb) - Snapshot complet de l'analyse IA
      - `genere_le` (timestamptz) - Date de génération
      - `est_formation` (boolean) - Mode formation ou production

    - `hypotheses_ia`
      - `id` (uuid, clé primaire)
      - `rapport_id` (uuid, FK vers rapports_ia_hebdo)
      - `type` (text) - equipement_risque / alerte / recommandation
      - `titre` (text) - Titre court de l'hypothèse
      - `description` (text) - Description détaillée
      - `donnees` (jsonb) - Données spécifiques au type
      - `priorite` (text) - haute/moyenne/basse
      - `statut` (text) - en_attente/validee/rejetee
      - `validee_par_id` (uuid, FK vers utilisateurs)
      - `validee_le` (timestamptz)
      - `commentaire_validation` (text)
      - `est_formation` (boolean)
      - `cree_le` (timestamptz)

  2. Sécurité
    - RLS activé sur les deux tables
    - Politiques restrictives pour direction et chef_maintenance uniquement
*/

-- Table rapports_ia_hebdo
CREATE TABLE IF NOT EXISTS rapports_ia_hebdo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_iso text NOT NULL,
  score_sante integer NOT NULL DEFAULT 0,
  tendance text NOT NULL DEFAULT 'stable',
  donnees_analyse jsonb NOT NULL DEFAULT '{}'::jsonb,
  genere_le timestamptz NOT NULL DEFAULT now(),
  est_formation boolean NOT NULL DEFAULT false,
  cree_le timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rapports_ia_hebdo_tendance_check
    CHECK (tendance IN ('stable', 'amelioration', 'degradation')),
  CONSTRAINT rapports_ia_hebdo_score_check
    CHECK (score_sante >= 0 AND score_sante <= 100),
  CONSTRAINT rapports_ia_hebdo_semaine_unique
    UNIQUE (semaine_iso, est_formation)
);

ALTER TABLE rapports_ia_hebdo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direction et chefs peuvent lire les rapports IA"
  ON rapports_ia_hebdo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Insertion rapports IA via service role uniquement"
  ON rapports_ia_hebdo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

-- Table hypotheses_ia
CREATE TABLE IF NOT EXISTS hypotheses_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapport_id uuid NOT NULL REFERENCES rapports_ia_hebdo(id),
  type text NOT NULL,
  titre text NOT NULL,
  description text NOT NULL DEFAULT '',
  donnees jsonb NOT NULL DEFAULT '{}'::jsonb,
  priorite text NOT NULL DEFAULT 'moyenne',
  statut text NOT NULL DEFAULT 'en_attente',
  validee_par_id uuid REFERENCES utilisateurs(id),
  validee_le timestamptz,
  commentaire_validation text,
  est_formation boolean NOT NULL DEFAULT false,
  cree_le timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT hypotheses_ia_type_check
    CHECK (type IN ('equipement_risque', 'alerte', 'recommandation')),
  CONSTRAINT hypotheses_ia_priorite_check
    CHECK (priorite IN ('haute', 'moyenne', 'basse')),
  CONSTRAINT hypotheses_ia_statut_check
    CHECK (statut IN ('en_attente', 'validee', 'rejetee'))
);

ALTER TABLE hypotheses_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direction et chefs peuvent lire les hypotheses"
  ON hypotheses_ia FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Direction et chefs peuvent valider les hypotheses"
  ON hypotheses_ia FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Direction et chefs peuvent creer des hypotheses"
  ON hypotheses_ia FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_hypotheses_ia_rapport_id ON hypotheses_ia(rapport_id);
CREATE INDEX IF NOT EXISTS idx_hypotheses_ia_statut ON hypotheses_ia(statut);
CREATE INDEX IF NOT EXISTS idx_rapports_ia_hebdo_semaine ON rapports_ia_hebdo(semaine_iso);
CREATE INDEX IF NOT EXISTS idx_rapports_ia_hebdo_formation ON rapports_ia_hebdo(est_formation);
