/*
  # Symptomes predefinis + incidents.equipement_id nullable

  1. Nouvelle table `symptomes`
    - `id` (uuid, primary key)
    - `categorie_id` (uuid, FK categories_equipement)
    - `libelle` (text) - ex: "Ecran noir", "Bruit anormal"
    - `icone` (text) - emoji ou code
    - `ordre` (int) - tri
    - `actif` (boolean)
    - `cree_le` (timestamptz)
    - Contrainte unique (categorie_id, libelle)

  2. Modification `incidents`
    - `equipement_id` passe de NOT NULL a nullable
      (cas "equipement absent de la liste" signale par le staff)
    - Ajout colonne `validation_manager` (text, default 'auto')
      Valeurs: 'auto' (pas de validation requise), 'en_attente', 'valide', 'refuse'
      Les incidents source='staff_caisse' commencent a 'en_attente'
    - Ajout colonne `valide_par_manager_id` (uuid, FK utilisateurs)
    - Ajout colonne `valide_le` (timestamptz)

  3. Securite
    - RLS sur `symptomes` : lecture pour tous les authentifies
    - Ecriture direction/admin_it/chef_maintenance
    - Policies separees SELECT, INSERT, UPDATE, DELETE

  4. Index
    - idx_symptomes_categorie sur categorie_id (WHERE actif=true)

  5. Notes
    - Aucun trigger modifie
    - Le seed des symptomes sera fait par edge function separee
*/

-- 1. Table symptomes
CREATE TABLE IF NOT EXISTS symptomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id uuid NOT NULL REFERENCES categories_equipement(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  icone text,
  ordre int DEFAULT 0,
  actif boolean DEFAULT true,
  cree_le timestamptz DEFAULT now(),
  UNIQUE(categorie_id, libelle)
);

CREATE INDEX IF NOT EXISTS idx_symptomes_categorie
  ON symptomes(categorie_id) WHERE actif = true;

ALTER TABLE symptomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptomes_select_authenticated"
  ON symptomes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "symptomes_insert_direction_admin"
  ON symptomes FOR INSERT
  TO authenticated
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

CREATE POLICY "symptomes_update_direction_admin"
  ON symptomes FOR UPDATE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

CREATE POLICY "symptomes_delete_direction_admin"
  ON symptomes FOR DELETE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

-- 2. incidents.equipement_id → nullable
ALTER TABLE incidents ALTER COLUMN equipement_id DROP NOT NULL;

-- 3. Nouvelles colonnes incidents pour validation manager
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'validation_manager'
  ) THEN
    ALTER TABLE incidents ADD COLUMN validation_manager text DEFAULT 'auto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'valide_par_manager_id'
  ) THEN
    ALTER TABLE incidents ADD COLUMN valide_par_manager_id uuid REFERENCES utilisateurs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'valide_le'
  ) THEN
    ALTER TABLE incidents ADD COLUMN valide_le timestamptz;
  END IF;
END $$;
