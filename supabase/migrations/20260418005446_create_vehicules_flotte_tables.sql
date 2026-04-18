/*
  # Create Fleet Tracking tables

  1. New Tables
    - `vehicules`
      - `id` (uuid, PK)
      - `code` (text) - Internal reference code
      - `libelle` (text) - Display name
      - `immatriculation` (text) - License plate
      - `marque` (text) - Vehicle brand
      - `modele` (text) - Vehicle model
      - `parc_id` (uuid, FK parcs) - Assigned park
      - `assigne_a_id` (uuid, FK utilisateurs) - Assigned technician
      - `tracker_id` (text) - GPS tracker ID
      - `tracker_type` (text) - Tracker provider type
      - `statut` (text) - actif/maintenance/hors_service
      - `photo_url` (text) - Vehicle photo
      - `km_actuel` (integer) - Current mileage
      - `date_derniere_revision` (date) - Last service date
      - `date_prochaine_revision` (date) - Next service date

    - `vehicules_positions`
      - `id` (uuid, PK)
      - `vehicule_id` (uuid, FK vehicules) - Associated vehicle
      - `latitude` (double precision) - GPS lat
      - `longitude` (double precision) - GPS lng
      - `vitesse` (double precision) - Speed in km/h
      - `cap` (double precision) - Heading
      - `altitude` (double precision)
      - `batterie_tracker` (integer) - Tracker battery %
      - `moteur_allume` (boolean) - Engine on/off
      - `adresse` (text) - Geocoded address
      - `enregistre_le` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Authenticated users can read vehicles and positions
    - Direction/chef_maintenance can insert and update vehicles
    - Positions insertable by authenticated (for tracker ingestion)

  3. Indexes
    - Composite index on vehicule_id + enregistre_le for fast position lookups
*/

CREATE TABLE IF NOT EXISTS vehicules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  libelle text NOT NULL,
  immatriculation text,
  marque text,
  modele text,
  parc_id uuid REFERENCES parcs(id),
  assigne_a_id uuid REFERENCES utilisateurs(id),
  tracker_id text,
  tracker_type text DEFAULT 'copenhagen',
  statut text DEFAULT 'actif',
  photo_url text,
  km_actuel integer DEFAULT 0,
  date_derniere_revision date,
  date_prochaine_revision date,
  cree_le timestamptz DEFAULT now(),
  modifie_le timestamptz DEFAULT now(),

  CONSTRAINT vehicules_statut_check CHECK (statut IN ('actif', 'maintenance', 'hors_service'))
);

CREATE TABLE IF NOT EXISTS vehicules_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule_id uuid NOT NULL REFERENCES vehicules(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  vitesse double precision DEFAULT 0,
  cap double precision,
  altitude double precision,
  batterie_tracker integer,
  moteur_allume boolean DEFAULT false,
  adresse text,
  enregistre_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vpos_vehicule_date ON vehicules_positions (vehicule_id, enregistre_le DESC);

ALTER TABLE vehicules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicules_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicles"
  ON vehicules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Direction and chefs can insert vehicles"
  ON vehicules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Direction and chefs can update vehicles"
  ON vehicules FOR UPDATE
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

CREATE POLICY "Authenticated users can view vehicle positions"
  ON vehicules_positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );

CREATE POLICY "Authenticated users can insert vehicle positions"
  ON vehicules_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
      AND r.code IN ('direction', 'chef_maintenance')
    )
  );
