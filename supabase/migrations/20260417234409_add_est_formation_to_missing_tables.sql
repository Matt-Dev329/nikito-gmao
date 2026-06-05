/*
  # Add est_formation column to all missing tables

  This migration ensures complete isolation of training (formation) data
  from production data by adding the `est_formation` boolean flag to every
  transactional table that was missing it.

  1. Modified Tables
    - `equipements` — add `est_formation` boolean NOT NULL DEFAULT false
    - `controle_items` — add `est_formation` boolean NOT NULL DEFAULT false
    - `interventions` — add `est_formation` boolean NOT NULL DEFAULT false
    - `certifications` — add `est_formation` boolean NOT NULL DEFAULT false
    - `maintenances_preventives` — add `est_formation` boolean NOT NULL DEFAULT false
    - `pieces_detachees` — add `est_formation` boolean NOT NULL DEFAULT false

  2. Indexes
    - Partial indexes on `est_formation = true` for each table to speed up filtering

  3. Important Notes
    - No data is lost — only adds new columns with safe defaults
    - All existing rows get `est_formation = false` (production data)
    - Formation data will be marked in the next migration step
*/

-- equipements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipements' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE equipements ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- controle_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controle_items' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE controle_items ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- interventions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interventions' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE interventions ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- certifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certifications' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE certifications ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- maintenances_preventives
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenances_preventives' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE maintenances_preventives ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- pieces_detachees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pieces_detachees' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE pieces_detachees ADD COLUMN est_formation boolean NOT NULL DEFAULT false;

  END IF;

END $$;


-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_equipements_formation ON equipements (est_formation) WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_controle_items_formation ON controle_items (est_formation) WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_interventions_formation ON interventions (est_formation) WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_certifications_formation ON certifications (est_formation) WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_maintenances_prev_formation ON maintenances_preventives (est_formation) WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_pieces_detachees_formation ON pieces_detachees (est_formation) WHERE est_formation = true;

;
