/*
  # Photo AVANT obligatoire pour démarrer une intervention

  `demarrer_intervention_photo(p_incident_id, p_photo_avant)` : comme
  demarrer_intervention, mais exige la photo AVANT (enregistrée dans
  interventions.photos_avant). Une intervention déjà démarrée qui a déjà sa
  photo peut être reprise sans nouvelle photo.
  L'ancien `demarrer_intervention` (sans photo) est refusé : impossible de
  commencer une réparation sans photo AVANT, même depuis une ancienne
  version de l'appli.
*/

CREATE OR REPLACE FUNCTION public.demarrer_intervention_photo(p_incident_id uuid, p_photo_avant text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_role text := current_role_code()::text;
  v_incident record;
  v_intervention record;
  v_photo text := NULLIF(trim(p_photo_avant), '');
BEGIN
  IF v_utilisateur_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé à démarrer une intervention' USING ERRCODE = '42501';
  END IF;

  SELECT id, statut, est_formation, assigne_a_id INTO v_incident
  FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.statut IN ('resolu', 'ferme') THEN
    RAISE EXCEPTION 'Ce ticket est déjà résolu';
  END IF;

  SELECT id, debut, photos_avant INTO v_intervention
  FROM interventions
  WHERE incident_id = p_incident_id AND fin IS NULL
  ORDER BY debut DESC
  LIMIT 1;

  IF v_photo IS NULL AND (v_intervention.id IS NULL OR COALESCE(array_length(v_intervention.photos_avant, 1), 0) = 0) THEN
    RAISE EXCEPTION 'Photo AVANT obligatoire : prends la photo du problème avant de commencer la réparation';
  END IF;

  IF v_intervention.id IS NULL THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, est_formation, photos_avant)
    VALUES (p_incident_id, v_utilisateur_id, now(), v_incident.est_formation, ARRAY[v_photo])
    RETURNING id, debut, photos_avant INTO v_intervention;
  ELSIF v_photo IS NOT NULL AND COALESCE(array_length(v_intervention.photos_avant, 1), 0) = 0 THEN
    UPDATE interventions SET photos_avant = ARRAY[v_photo] WHERE id = v_intervention.id;
  END IF;

  UPDATE incidents
     SET statut = 'en_cours'::statut_incident,
         assigne_a_id = COALESCE(assigne_a_id, v_utilisateur_id),
         pause_motif = NULL,
         pause_depuis = NULL,
         attente_piece = false,
         externe = false
   WHERE id = p_incident_id
     AND (statut <> 'en_cours' OR attente_piece OR externe);

  RETURN jsonb_build_object('intervention_id', v_intervention.id, 'debut', v_intervention.debut);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.demarrer_intervention_photo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demarrer_intervention_photo(uuid, text) TO authenticated;

-- Démarrage sans photo : refusé (anciennes versions de l'appli comprises)
CREATE OR REPLACE FUNCTION public.demarrer_intervention(p_incident_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  RETURN demarrer_intervention_photo(p_incident_id, NULL);
END;
$$;
