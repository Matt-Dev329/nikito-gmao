/*
  # Ajout colonne est_formation sur les tables operationnelles

  1. Tables modifiees
    - `controles` : ajout `est_formation` (boolean, default false)
    - `incidents` : ajout `est_formation` (boolean, default false)
    - `fiches_5_pourquoi` : ajout `est_formation` (boolean, default false)
    - `plaintes_clients` : ajout `est_formation` (boolean, default false)

  2. Index
    - Index sur est_formation pour filtrer rapidement les donnees formation vs production

  3. Notes
    - Permet de separer les donnees de formation des donnees de production
    - Default false = les donnees existantes restent en production
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controles' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE controles ADD COLUMN est_formation boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE incidents ADD COLUMN est_formation boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiches_5_pourquoi' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE fiches_5_pourquoi ADD COLUMN est_formation boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'est_formation'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN est_formation boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_controles_est_formation ON controles(est_formation);
CREATE INDEX IF NOT EXISTS idx_incidents_est_formation ON incidents(est_formation);
CREATE INDEX IF NOT EXISTS idx_fiches_5p_est_formation ON fiches_5_pourquoi(est_formation);
CREATE INDEX IF NOT EXISTS idx_plaintes_est_formation ON plaintes_clients(est_formation);
