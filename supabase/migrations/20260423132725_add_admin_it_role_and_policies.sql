/*
  # Create admin_it role row and RLS policies

  1. Changes
    - Insert 'admin_it' row into the roles table with ordre=6
  2. Security
    - admin_it gets SELECT on: config_globale, utilisateurs, parcs, incidents, equipements
    - admin_it gets UPDATE on: config_globale
  3. Notes
    - This role is for external IT service providers
    - They can monitor system health, DB stats, and manage configuration
    - They cannot create/delete business data (incidents, controls, etc.)
*/

INSERT INTO roles (code, nom, permissions, ordre)
VALUES ('admin_it', 'Administrateur IT', '{}', 6)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config_globale' AND policyname = 'admin_it_select_config') THEN
    CREATE POLICY "admin_it_select_config" ON config_globale FOR SELECT TO authenticated
    USING (current_role_code() = 'admin_it');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config_globale' AND policyname = 'admin_it_update_config') THEN
    CREATE POLICY "admin_it_update_config" ON config_globale FOR UPDATE TO authenticated
    USING (current_role_code() = 'admin_it')
    WITH CHECK (current_role_code() = 'admin_it');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'utilisateurs' AND policyname = 'admin_it_select_utilisateurs') THEN
    CREATE POLICY "admin_it_select_utilisateurs" ON utilisateurs FOR SELECT TO authenticated
    USING (current_role_code() = 'admin_it');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parcs' AND policyname = 'admin_it_select_parcs') THEN
    CREATE POLICY "admin_it_select_parcs" ON parcs FOR SELECT TO authenticated
    USING (current_role_code() = 'admin_it');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'admin_it_select_incidents') THEN
    CREATE POLICY "admin_it_select_incidents" ON incidents FOR SELECT TO authenticated
    USING (current_role_code() = 'admin_it');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'equipements' AND policyname = 'admin_it_select_equipements') THEN
    CREATE POLICY "admin_it_select_equipements" ON equipements FOR SELECT TO authenticated
    USING (current_role_code() = 'admin_it');
  END IF;
END $$;
