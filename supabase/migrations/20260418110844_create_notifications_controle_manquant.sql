/*
  # Create notifications_controle_manquant table

  1. New Tables
    - `notifications_controle_manquant`
      - `id` (uuid, primary key)
      - `parc_id` (uuid, FK -> parcs)
      - `date_controle` (date) - the date for which the control is missing
      - `type_alerte` (text) - 'app' or 'sms'
      - `heure_alerte` (text) - the time the alert should be/was triggered (e.g. "08:00")
      - `heure_ouverture` (text) - the scheduled opening time for that day
      - `est_vacances` (boolean) - whether the park was in vacation mode
      - `sms_envoye` (boolean) - whether SMS was actually sent (future use)
      - `cree_le` (timestamptz)

  2. Security
    - Enable RLS on `notifications_controle_manquant` table
    - Add policies for authenticated users to read and insert

  3. Notes
    - This table tracks which missing-control alerts have been created
    - Prevents duplicate alerts for the same park/date/type
    - Unique constraint on (parc_id, date_controle, type_alerte)
*/

CREATE TABLE IF NOT EXISTS notifications_controle_manquant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id),
  date_controle date NOT NULL DEFAULT CURRENT_DATE,
  type_alerte text NOT NULL CHECK (type_alerte IN ('app', 'sms')),
  heure_alerte text NOT NULL,
  heure_ouverture text NOT NULL,
  est_vacances boolean NOT NULL DEFAULT false,
  sms_envoye boolean NOT NULL DEFAULT false,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parc_id, date_controle, type_alerte)
);

ALTER TABLE notifications_controle_manquant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read controle manquant notifications"
  ON notifications_controle_manquant
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert controle manquant notifications"
  ON notifications_controle_manquant
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
