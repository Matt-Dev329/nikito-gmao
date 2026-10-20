-- Clôture rapide d'un ticket (chef d'équipe, direction, admin IT, directeurs
-- de parc sur leurs parcs) avec justification obligatoire : le ticket passe
-- « résolu » sans intervention terrain (déjà réglé, rien à faire…). Une
-- intervention est enregistrée avec la justification, pour garder la trace
-- dans les rapports de réparation. Un ticket en attente de validation est
-- validé au passage.

CREATE OR REPLACE FUNCTION public.cloturer_ticket_rapide(p_incident_id uuid, p_justification text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := current_role_code()::text;
  v_moi uuid := current_utilisateur_id();
  v_incident record;
  v_justif text := trim(coalesce(p_justification, ''));
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT (v_role IN ('direction', 'chef_maintenance', 'admin_it')
          OR (v_role = 'directeur_parc' AND parcs_du_ticket(p_incident_id) && current_parc_ids())) THEN
    RAISE EXCEPTION 'Clôture rapide réservée au chef d''équipe et aux directeurs de parc' USING ERRCODE = '42501';
  END IF;
  IF length(v_justif) < 5 THEN
    RAISE EXCEPTION 'Justification obligatoire';
  END IF;

  SELECT id, statut, est_formation, validation_manager INTO v_incident
  FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.statut IN ('resolu', 'ferme', 'annule') THEN
    RAISE EXCEPTION 'Ce ticket est déjà clôturé';
  END IF;

  -- Intervention en cours fermée, sinon intervention « clôture rapide » créée
  UPDATE interventions
     SET fin = now(),
         actions_realisees = concat_ws(E'\n', nullif(actions_realisees, ''), 'Clôture rapide : ' || v_justif)
   WHERE incident_id = p_incident_id AND fin IS NULL;
  IF NOT FOUND THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, actions_realisees, est_formation)
    VALUES (p_incident_id, v_moi, now(), now(), 'Clôture rapide : ' || v_justif, v_incident.est_formation);
  END IF;

  UPDATE incidents
     SET statut = 'resolu'::statut_incident,
         resolu_le = now(),
         resolu_par_id = v_moi,
         validation_manager = CASE WHEN validation_manager = 'en_attente' THEN 'valide' ELSE validation_manager END,
         valide_le = CASE WHEN validation_manager = 'en_attente' THEN now() ELSE valide_le END,
         valide_par_manager_id = CASE WHEN validation_manager = 'en_attente' THEN v_moi ELSE valide_par_manager_id END,
         attente_piece = false,
         pause_motif = NULL,
         pause_depuis = NULL,
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('cloture_rapide', v_justif)
   WHERE id = p_incident_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cloturer_ticket_rapide(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cloturer_ticket_rapide(uuid, text) TO authenticated;
