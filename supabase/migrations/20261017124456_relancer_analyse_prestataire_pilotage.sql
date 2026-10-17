-- Relance d'analyse : mêmes droits que la lecture du rapport (acces_pilotage_parc)
CREATE OR REPLACE FUNCTION public.relancer_analyse_prestataire(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_parc uuid;
BEGIN
  SELECT parc_id INTO v_parc FROM documents_techniques WHERE id = p_document_id AND type = 'prestataire' AND actif;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapport prestataire introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_parc) THEN
    RAISE EXCEPTION 'Accès refusé à ce rapport' USING ERRCODE = '42501';
  END IF;
  INSERT INTO analyses_rapports_prestataires (document_id, statut)
  VALUES (p_document_id, 'en_attente')
  ON CONFLICT (document_id) DO UPDATE SET statut = 'en_attente', erreur = NULL;
END;
$$;