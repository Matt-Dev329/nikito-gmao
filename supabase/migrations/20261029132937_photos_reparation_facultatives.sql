-- Photos AVANT / APRÈS d'une réparation facultatives pour le chef d'équipe
-- et les techniciens au profil « arcade » (obligatoires pour les autres).
CREATE OR REPLACE FUNCTION public.photos_reparation_facultatives()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.id = (SELECT current_utilisateur_id())
      AND (r.code = 'chef_maintenance' OR (r.code = 'technicien' AND u.profil_technicien = 'arcade'))
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.photos_reparation_facultatives() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.photos_reparation_facultatives() TO authenticated;

CREATE OR REPLACE FUNCTION public.demarrer_intervention_photo(p_incident_id uuid, p_photo_avant text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF (v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'technicien', 'admin_it')) AND NOT intervenant_autorise(p_incident_id) THEN
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

  -- Photo AVANT obligatoire, sauf chef d'équipe et techniciens arcade
  IF v_photo IS NULL AND NOT photos_reparation_facultatives()
     AND (v_intervention.id IS NULL OR COALESCE(array_length(v_intervention.photos_avant, 1), 0) = 0) THEN
    RAISE EXCEPTION 'Photo AVANT obligatoire : prends la photo du problème avant de commencer la réparation';
  END IF;

  IF v_intervention.id IS NULL THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, est_formation, photos_avant)
    VALUES (p_incident_id, v_utilisateur_id, now(), v_incident.est_formation,
            CASE WHEN v_photo IS NULL THEN '{}'::text[] ELSE ARRAY[v_photo] END)
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
$function$;