/*
  # Démarrer une intervention

  RPC `demarrer_intervention(p_incident_id)` appelée par le bouton
  « Démarrer intervention » :
  - si une intervention est déjà ouverte (fin IS NULL) sur ce ticket, elle est
    réutilisée (idempotent : double clic, réseau instable, reprise) ;
  - sinon une intervention est créée (technicien = utilisateur courant,
    début = maintenant, même mode formation que le ticket) ;
  - le ticket passe « en_cours », est assigné à l'utilisateur s'il ne l'était
    pas, et sort de pause le cas échéant.
  Renvoie l'id de l'intervention et son heure de début (chrono).
*/

CREATE OR REPLACE FUNCTION public.demarrer_intervention(p_incident_id uuid)
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

  SELECT id, debut INTO v_intervention
  FROM interventions
  WHERE incident_id = p_incident_id AND fin IS NULL
  ORDER BY debut DESC
  LIMIT 1;

  IF v_intervention.id IS NULL THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, est_formation)
    VALUES (p_incident_id, v_utilisateur_id, now(), v_incident.est_formation)
    RETURNING id, debut INTO v_intervention;
  END IF;

  UPDATE incidents
     SET statut = 'en_cours'::statut_incident,
         assigne_a_id = COALESCE(assigne_a_id, v_utilisateur_id),
         pause_motif = NULL,
         pause_depuis = NULL
   WHERE id = p_incident_id
     AND statut <> 'en_cours';

  RETURN jsonb_build_object('intervention_id', v_intervention.id, 'debut', v_intervention.debut);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.demarrer_intervention(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demarrer_intervention(uuid) TO authenticated;
