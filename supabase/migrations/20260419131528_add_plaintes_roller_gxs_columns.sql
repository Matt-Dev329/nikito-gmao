/*
  # Add Roller GXS integration columns to plaintes_clients

  1. Modified Tables
    - `plaintes_clients`
      - `source` (text, default 'manuel') - Origin of the complaint (manuel, roller_gxs)
      - `source_externe_id` (text) - External ID from Roller GXS for deduplication
      - `client_nom` (text) - Client name
      - `client_email` (text) - Client email
      - `client_telephone` (text) - Client phone
      - `date_visite` (date) - Visit date
      - `note_globale` (integer) - Overall rating 1-5
      - `categorie` (text, default 'autre') - Category of complaint
      - `statut` (text, default 'nouveau') - Workflow status with check constraint
      - `priorite` (text, default 'normale') - Priority level
      - `qualifie_par_id` (uuid) - Who qualified the complaint
      - `qualifie_le` (timestamptz) - When it was qualified
      - `motif_qualification` (text) - Qualification reason
      - `incident_cree_id` (uuid) - Link to created incident

  2. Indexes
    - Unique index on source_externe_id for deduplication

  3. Security
    - No RLS changes (table already has RLS enabled)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'source'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN source text DEFAULT 'manuel';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'source_externe_id'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN source_externe_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'client_nom'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN client_nom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN client_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'client_telephone'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN client_telephone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'date_visite'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN date_visite date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'note_globale'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN note_globale integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'categorie'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN categorie text DEFAULT 'autre';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'statut'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN statut text DEFAULT 'nouveau';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN priorite text DEFAULT 'normale';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'qualifie_par_id'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN qualifie_par_id uuid REFERENCES utilisateurs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'qualifie_le'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN qualifie_le timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'motif_qualification'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN motif_qualification text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'incident_cree_id'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN incident_cree_id uuid REFERENCES incidents(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_plainte_source_id'
  ) THEN
    CREATE UNIQUE INDEX idx_plainte_source_id ON plaintes_clients (source_externe_id) WHERE source_externe_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'plaintes_clients_statut_check'
  ) THEN
    ALTER TABLE plaintes_clients ADD CONSTRAINT plaintes_clients_statut_check
      CHECK (statut IN ('nouveau', 'a_qualifier', 'maintenance_confirmee', 'hors_maintenance', 'traite'));
  END IF;
END $$;