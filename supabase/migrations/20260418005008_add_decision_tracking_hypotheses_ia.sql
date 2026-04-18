/*
  # Suivi des decisions sur les hypotheses IA

  1. Modifications de la table `hypotheses_ia`
    - `resultat_reel` (text) - bon_choix / mauvais_choix / non_evalue
    - `resultat_commentaire` (text) - Justification du resultat reel
    - `resultat_evalue_par_id` (uuid, FK utilisateurs) - Qui a evalue le resultat
    - `resultat_evalue_le` (timestamptz) - Quand le resultat a ete evalue

  2. Nouvelle table `historique_decisions_ia`
    - Enregistre chaque action (validation, rejet, evaluation du resultat) avec horodatage
    - Permet de tracer chronologiquement toutes les decisions
    - `id` (uuid, PK)
    - `hypothese_id` (uuid, FK hypotheses_ia)
    - `action` (text) - validee / rejetee / resultat_bon / resultat_mauvais
    - `utilisateur_id` (uuid, FK utilisateurs)
    - `commentaire` (text)
    - `cree_le` (timestamptz)

  3. Securite
    - RLS activee avec politiques restrictives pour direction et chef_maintenance
*/

-- Ajout des colonnes de suivi de resultat sur hypotheses_ia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hypotheses_ia' AND column_name = 'resultat_reel'
  ) THEN
    ALTER TABLE hypotheses_ia ADD COLUMN resultat_reel text DEFAULT 'non_evalue';
    ALTER TABLE hypotheses_ia ADD CONSTRAINT hypotheses_ia_resultat_check
      CHECK (resultat_reel IN ('bon_choix', 'mauvais_choix', 'non_evalue'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hypotheses_ia' AND column_name = 'resultat_commentaire'
  ) THEN
    ALTER TABLE hypotheses_ia ADD COLUMN resultat_commentaire text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hypotheses_ia' AND column_name = 'resultat_evalue_par_id'
  ) THEN
    ALTER TABLE hypotheses_ia ADD COLUMN resultat_evalue_par_id uuid REFERENCES utilisateurs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hypotheses_ia' AND column_name = 'resultat_evalue_le'
  ) THEN
    ALTER TABLE hypotheses_ia ADD COLUMN resultat_evalue_le timestamptz;
  END IF;
END $$;

-- Table historique des decisions
CREATE TABLE IF NOT EXISTS historique_decisions_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothese_id uuid NOT NULL REFERENCES hypotheses_ia(id),
  action text NOT NULL,
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id),
  utilisateur_nom text NOT NULL DEFAULT '',
  commentaire text,
  donnees_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  cree_le timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT historique_decisions_ia_action_check
    CHECK (action IN ('validee', 'rejetee', 'resultat_bon', 'resultat_mauvais'))
);

ALTER TABLE historique_decisions_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direction et chefs lisent historique decisions"
  ON historique_decisions_ia FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Direction et chefs inserent historique decisions"
  ON historique_decisions_ia FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

-- Index pour requetes frequentes
CREATE INDEX IF NOT EXISTS idx_historique_decisions_ia_hypothese ON historique_decisions_ia(hypothese_id);
CREATE INDEX IF NOT EXISTS idx_historique_decisions_ia_utilisateur ON historique_decisions_ia(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_historique_decisions_ia_action ON historique_decisions_ia(action);
CREATE INDEX IF NOT EXISTS idx_hypotheses_ia_resultat ON hypotheses_ia(resultat_reel);
