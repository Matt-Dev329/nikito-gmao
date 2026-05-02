/*
  # Extraction IA des PV de commission

  1. prescriptions_securite
    - Nouveaux statuts : 'brouillon', 'rejete_extraction'
    - Nouvelles colonnes : extrait_par_ia, extraction_id, confiance_extraction

  2. Nouvelle table extractions_pv
    - Trace chaque extraction IA (PDF envoye a Claude)
    - Conserve la reponse brute, les stats et les couts

  3. Securite
    - RLS activee
    - Lecture : direction/admin_it partout, autres seulement leurs parcs
    - Ecriture : direction, admin_it, chef_maintenance
*/

ALTER TABLE prescriptions_securite DROP CONSTRAINT IF EXISTS prescriptions_securite_statut_check;

ALTER TABLE prescriptions_securite
  ADD CONSTRAINT prescriptions_securite_statut_check
  CHECK (statut IN (
    'brouillon',
    'a_lever',
    'en_cours',
    'levee_proposee',
    'levee_validee',
    'caduque',
    'rejete_extraction'
  ));

ALTER TABLE prescriptions_securite
  ADD COLUMN IF NOT EXISTS extrait_par_ia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_id uuid,
  ADD COLUMN IF NOT EXISTS confiance_extraction numeric(3,2);

CREATE TABLE IF NOT EXISTS extractions_pv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES commissions_securite(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents_chantier(id) ON DELETE SET NULL,
  parc_id uuid NOT NULL REFERENCES parcs(id),
  pv_url text NOT NULL,
  pv_filename text,
  statut text NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours', 'reussie', 'echec', 'validee', 'partiellement_validee')),
  nb_prescriptions_extraites int DEFAULT 0,
  nb_prescriptions_validees int DEFAULT 0,
  nb_prescriptions_rejetees int DEFAULT 0,
  raw_response_claude jsonb,
  duree_traitement_ms int,
  cout_estime numeric(6,4),
  erreur_message text,
  cree_par_id uuid REFERENCES utilisateurs(id),
  cree_le timestamptz DEFAULT now(),
  validee_le timestamptz
);

CREATE INDEX IF NOT EXISTS idx_extractions_pv_commission ON extractions_pv(commission_id);
CREATE INDEX IF NOT EXISTS idx_extractions_pv_statut ON extractions_pv(statut);
CREATE INDEX IF NOT EXISTS idx_prescriptions_extraction_id ON prescriptions_securite(extraction_id);

ALTER TABLE extractions_pv ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extractions_pv_select" ON extractions_pv;
CREATE POLICY "extractions_pv_select"
  ON extractions_pv FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

DROP POLICY IF EXISTS "extractions_pv_insert" ON extractions_pv;
CREATE POLICY "extractions_pv_insert"
  ON extractions_pv FOR INSERT
  TO authenticated
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

DROP POLICY IF EXISTS "extractions_pv_update" ON extractions_pv;
CREATE POLICY "extractions_pv_update"
  ON extractions_pv FOR UPDATE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

DROP POLICY IF EXISTS "extractions_pv_delete" ON extractions_pv;
CREATE POLICY "extractions_pv_delete"
  ON extractions_pv FOR DELETE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it'));
