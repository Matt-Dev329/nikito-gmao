/*
  # Lot 3 - Workflow tickets : reassignement, pause et brouillon

  ## Description
  Le client demande trois evolutions sur la gestion des tickets (incidents) :
  1. Pouvoir reassigner un ticket a un autre technicien
  2. Pouvoir mettre un ticket en pause
  3. Pouvoir enregistrer un ticket en brouillon avant validation

  ## Schema Changes

  ### incidents (modified)
  - `assigne_a_id` (uuid nullable) : FK vers utilisateurs, technicien actuellement assigne au ticket
  - `est_brouillon` (boolean default false) : indique si le ticket est en brouillon
  - `pause_motif` (text nullable) : motif de la mise en pause
  - `pause_depuis` (timestamptz nullable) : timestamp de la mise en pause
  - Nouvelle valeur `en_pause` ajoutee a l'enum `statut_incident`

  ## RPC
  - `reassigner_incident(p_incident_id uuid, p_nouveau_technicien_id uuid)`
  - `mettre_en_pause_incident(p_incident_id uuid, p_motif text)`
  - `reprendre_incident(p_incident_id uuid)`
  - `valider_brouillon_incident(p_incident_id uuid)`

  ## Security
  - Toutes les RPC verifient l'authentification
  - Les RPC sont accessibles aux roles direction, chef_maintenance, directeur_parc,
    manager_parc, technicien et admin_it
*/

-- 1. Add 'en_pause' to statut_incident enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'statut_incident' AND e.enumlabel = 'en_pause'
  ) THEN
    ALTER TYPE statut_incident ADD VALUE 'en_pause' AFTER 'en_cours';

  END IF;

END $$;


-- 2. Add new columns on incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'assigne_a_id'
  ) THEN
    ALTER TABLE incidents ADD COLUMN assigne_a_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'est_brouillon'
  ) THEN
    ALTER TABLE incidents ADD COLUMN est_brouillon boolean NOT NULL DEFAULT false;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'pause_motif'
  ) THEN
    ALTER TABLE incidents ADD COLUMN pause_motif text;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'pause_depuis'
  ) THEN
    ALTER TABLE incidents ADD COLUMN pause_depuis timestamptz;

  END IF;

END $$;

;
