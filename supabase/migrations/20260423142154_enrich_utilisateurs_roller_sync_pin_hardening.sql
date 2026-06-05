/*
  # Enrichissement utilisateurs pour sync Roller et durcissement PIN

  1. Colonnes ajoutees a `utilisateurs`
    - `roller_unique_id` (text, unique partiel) - cle Roller staffs.uniqueId
    - `pin_must_change` (boolean, default true) - force changement PIN au 1er login
    - `pin_failed_attempts` (int, default 0) - compteur echecs PIN consecutifs
    - `pin_locked_until` (timestamptz) - verrou temporaire apres 5 echecs
    - `last_synced_at` (timestamptz) - dernier sync Roller

  2. Assouplissement contrainte email
    - email passe de NOT NULL a nullable (staff PIN sans email)

  3. Nouvelle table `roller_role_mapping`
    - Mapping des noms de roles Roller vers codes role_utilisateur Alba
    - Seed initial : 5 mappings courants

  4. Securite
    - RLS sur `roller_role_mapping` : lecture pour authentifies, ecriture direction/admin_it
    - Index unique partiel sur roller_unique_id

  5. Notes
    - Aucune modification des tables roles, parcs, parcs_utilisateurs, invitations
    - Aucune suppression de donnees existantes
    - Le UNIQUE sur email reste fonctionnel (NULL traites comme distincts par PostgreSQL)
*/

-- 1. Nouvelles colonnes sur utilisateurs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'roller_unique_id'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN roller_unique_id text;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'pin_must_change'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN pin_must_change boolean DEFAULT true;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'pin_failed_attempts'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN pin_failed_attempts int DEFAULT 0 NOT NULL;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'pin_locked_until'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN pin_locked_until timestamptz;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN last_synced_at timestamptz;

  END IF;

END $$;


-- 2. Rendre email nullable (staff PIN n'ont pas d'email)
ALTER TABLE utilisateurs ALTER COLUMN email DROP NOT NULL;


-- 3. Index unique partiel sur roller_unique_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_utilisateurs_roller_unique_id
  ON utilisateurs(roller_unique_id)
  WHERE roller_unique_id IS NOT NULL;


-- 4. Table roller_role_mapping
CREATE TABLE IF NOT EXISTS roller_role_mapping (
  roller_role_name text PRIMARY KEY,
  role_code role_utilisateur NOT NULL,
  cree_le timestamptz DEFAULT now()
);


-- 5. Seed des mappings connus
INSERT INTO roller_role_mapping (roller_role_name, role_code) VALUES
  ('Direction', 'direction'),
  ('Manager', 'manager_parc'),
  ('Chef de maintenance', 'chef_maintenance'),
  ('Chef d''equipe maintenance', 'chef_maintenance'),
  ('Technicien', 'technicien')
ON CONFLICT (roller_role_name) DO NOTHING;


-- 6. RLS sur roller_role_mapping
ALTER TABLE roller_role_mapping ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Lecture mapping roles pour authentifies"
  ON roller_role_mapping FOR SELECT
  TO authenticated
  USING (current_role_code() IS NOT NULL);


CREATE POLICY "Ecriture mapping roles direction et admin_it"
  ON roller_role_mapping FOR INSERT
  TO authenticated
  WITH CHECK (current_role_code() IN ('direction', 'admin_it'));


CREATE POLICY "Modification mapping roles direction et admin_it"
  ON roller_role_mapping FOR UPDATE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it'));


CREATE POLICY "Suppression mapping roles direction et admin_it"
  ON roller_role_mapping FOR DELETE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it'));

;
