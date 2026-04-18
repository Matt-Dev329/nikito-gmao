/*
  # Create global configuration table

  1. New Tables
    - `config_globale`
      - `cle` (text, primary key) - configuration key
      - `valeur` (text, not null) - configuration value
      - `description` (text) - human-readable description
      - `modifie_le` (timestamptz, default now()) - last modified timestamp

  2. Security
    - Enable RLS on `config_globale`
    - Authenticated users can read all config
    - Only direction role can insert/update config

  3. Seed Data
    - `date_lancement` = '2026-05-15' (date when controls become mandatory)
    - `app_en_production` = 'false' (toggle for production mode)
*/

CREATE TABLE IF NOT EXISTS config_globale (
  cle text PRIMARY KEY,
  valeur text NOT NULL,
  description text,
  modifie_le timestamptz DEFAULT now()
);

ALTER TABLE config_globale ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config"
  ON config_globale
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Direction can update config"
  ON config_globale
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code = 'direction'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code = 'direction'
    )
  );

CREATE POLICY "Direction can insert config"
  ON config_globale
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code = 'direction'
    )
  );

INSERT INTO config_globale (cle, valeur, description) VALUES
  ('date_lancement', '2026-05-15', 'Date a partir de laquelle les controles sont obligatoires et les alertes actives'),
  ('app_en_production', 'false', 'Passer a true quand l''app est officiellement lancee')
ON CONFLICT (cle) DO NOTHING;
