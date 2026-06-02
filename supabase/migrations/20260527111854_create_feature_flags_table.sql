/*
  # Create feature flags access table

  1. New Tables
    - `feature_flags`
      - `id` (uuid, primary key)
      - `feature_code` (text, unique feature identifier)
      - `feature_label` (text, human-readable label)
      - `description` (text, short description)
      - `ordre` (integer, display order)
      - `actif_global` (boolean, master switch)
      - `roles_autorises` (text[], role codes with access)
      - `cree_le` (timestamptz)
      - `modifie_le` (timestamptz)

  2. Security
    - Enable RLS
    - All authenticated users can read
    - Only direction/admin_it can modify

  3. Seed data
    - All application modules pre-populated
*/

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code text UNIQUE NOT NULL,
  feature_label text NOT NULL,
  description text DEFAULT '',
  ordre integer DEFAULT 0,
  actif_global boolean DEFAULT true,
  roles_autorises text[] DEFAULT '{}',
  cree_le timestamptz DEFAULT now(),
  modifie_le timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Direction and admin_it can update feature flags"
  ON feature_flags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'admin_it')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'admin_it')
    )
  );

CREATE POLICY "Direction and admin_it can insert feature flags"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'admin_it')
    )
  );

CREATE POLICY "Direction and admin_it can delete feature flags"
  ON feature_flags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'admin_it')
    )
  );

INSERT INTO feature_flags (feature_code, feature_label, description, ordre, actif_global, roles_autorises) VALUES
  ('tableau_bord', 'Tableau de bord', 'Vue globale des KPI et indicateurs', 1, true, ARRAY['direction', 'chef_maintenance', 'manager_parc']),
  ('controles', 'Controles', 'Controles quotidiens, hebdo et mensuels', 2, true, ARRAY['direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel']),
  ('equipements', 'Equipements', 'Gestion du parc equipements', 3, true, ARRAY['direction', 'chef_maintenance', 'manager_parc', 'technicien']),
  ('interventions', 'Interventions', 'Suivi des interventions techniques', 4, true, ARRAY['direction', 'chef_maintenance', 'technicien']),
  ('ia_predictive', 'IA Predictive', 'Analyse predictive de maintenance', 5, true, ARRAY['direction', 'chef_maintenance']),
  ('cinq_pourquoi', '5 Pourquoi', 'Analyse causes racines', 6, true, ARRAY['direction', 'chef_maintenance', 'technicien']),
  ('recurrences', 'Recurrences', 'Detection de pannes recurrentes', 7, true, ARRAY['direction', 'chef_maintenance']),
  ('plaintes', 'Plaintes', 'Gestion des plaintes clients', 8, true, ARRAY['direction', 'chef_maintenance', 'manager_parc']),
  ('preventif', 'Maintenance preventive', 'Planification maintenance preventive', 9, true, ARRAY['direction', 'chef_maintenance', 'technicien']),
  ('stock', 'Stock pieces', 'Gestion du stock pieces detachees', 10, true, ARRAY['direction', 'chef_maintenance', 'technicien']),
  ('certifications', 'Certifications', 'Suivi des certifications et normes', 11, true, ARRAY['direction', 'chef_maintenance']),
  ('flotte', 'Flotte vehicules', 'Gestion de la flotte vehicules', 12, true, ARRAY['direction', 'chef_maintenance']),
  ('conformite', 'Conformite ERP', 'Module conformite commissions de securite', 13, true, ARRAY['direction', 'chef_maintenance']),
  ('bibliotheque', 'Bibliotheque points', 'Bibliotheque des points de controle', 14, true, ARRAY['direction', 'chef_maintenance']),
  ('notifications_ia', 'Notifications IA', 'Hypotheses et alertes IA', 15, true, ARRAY['direction', 'chef_maintenance']),
  ('formation', 'Mode formation', 'Environnement de formation', 16, true, ARRAY['direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel']),
  ('admin_parcs', 'Administration parcs', 'Gestion des parcs et attractions', 17, true, ARRAY['direction']),
  ('admin_utilisateurs', 'Administration utilisateurs', 'Gestion des utilisateurs et invitations', 18, true, ARRAY['direction']),
  ('admin_it', 'Administration IT', 'Diagnostics et configuration systeme', 19, true, ARRAY['direction', 'admin_it'])
ON CONFLICT (feature_code) DO NOTHING;
