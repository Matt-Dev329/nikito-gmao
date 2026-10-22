-- « Test de l'activité : oui / non » obligatoire pour fermer un ticket (toutes
-- les façons de le fermer) et pour enregistrer un bon d'intervention.
-- La réponse est gardée sur le ticket (incidents.test_activite), sur
-- l'intervention qui le ferme et sur le bon.

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS test_activite boolean;
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS test_activite boolean;
ALTER TABLE public.bons_intervention ADD COLUMN IF NOT EXISTS test_activite boolean;

-- Bons : réponse obligatoire pour tout nouveau bon (les anciens restent tels quels)
ALTER TABLE public.bons_intervention
  ADD CONSTRAINT bons_intervention_test_activite_obligatoire CHECK (test_activite IS NOT NULL) NOT VALID;

-- Ticket : pas de passage en « résolu » / « fermé » sans réponse
CREATE OR REPLACE FUNCTION public.fn_test_activite_obligatoire()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.statut IN ('resolu', 'ferme')
     AND OLD.statut NOT IN ('resolu', 'ferme')
     AND NEW.test_activite IS NULL THEN
    RAISE EXCEPTION 'Test de l''activité obligatoire (oui ou non) pour fermer le ticket : mets à jour l''appli si la case n''apparaît pas';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_test_activite_obligatoire
BEFORE UPDATE OF statut ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.fn_test_activite_obligatoire();

-- Clôture rapide avec la réponse au test de l'activité
CREATE OR REPLACE FUNCTION public.cloturer_ticket_rapide(p_incident_id uuid, p_justification text, p_test_activite boolean)
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
  IF p_test_activite IS NULL THEN
    RAISE EXCEPTION 'Test de l''activité obligatoire (oui ou non)';
  END IF;

  SELECT id, statut, est_formation, validation_manager INTO v_incident
  FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.statut IN ('resolu', 'ferme', 'annule') THEN
    RAISE EXCEPTION 'Ce ticket est déjà clôturé';
  END IF;

  UPDATE interventions
     SET fin = now(),
         test_activite = p_test_activite,
         actions_realisees = concat_ws(E'\n', nullif(actions_realisees, ''), 'Clôture rapide : ' || v_justif)
   WHERE incident_id = p_incident_id AND fin IS NULL;
  IF NOT FOUND THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, actions_realisees, est_formation, test_activite)
    VALUES (p_incident_id, v_moi, now(), now(), 'Clôture rapide : ' || v_justif, v_incident.est_formation, p_test_activite);
  END IF;

  UPDATE incidents
     SET statut = 'resolu'::statut_incident,
         resolu_le = now(),
         resolu_par_id = v_moi,
         test_activite = p_test_activite,
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
REVOKE ALL ON FUNCTION public.cloturer_ticket_rapide(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cloturer_ticket_rapide(uuid, text, boolean) TO authenticated;

-- Clôture d'un ticket confié à un intervenant extérieur, avec la réponse
CREATE OR REPLACE FUNCTION public.cloturer_ticket_exterieur(p_incident_id uuid, p_compte_rendu text, p_test_activite boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := current_role_code()::text;
  v_utilisateur_id uuid := current_utilisateur_id();
BEGIN
  IF (v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'technicien', 'admin_it')) AND NOT intervenant_autorise(p_incident_id) THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(p_compte_rendu), '') IS NULL THEN
    RAISE EXCEPTION 'Le compte-rendu de l''intervenant est obligatoire';
  END IF;
  IF p_test_activite IS NULL THEN
    RAISE EXCEPTION 'Test de l''activité obligatoire (oui ou non)';
  END IF;

  UPDATE incidents
     SET statut = 'resolu'::statut_incident,
         resolu_le = now(),
         resolu_par_id = v_utilisateur_id,
         test_activite = p_test_activite,
         meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
           'externe_compte_rendu', trim(p_compte_rendu),
           'externe_cloture_le', now(),
           'externe_cloture_par_id', v_utilisateur_id
         )
   WHERE id = p_incident_id AND externe AND statut NOT IN ('resolu', 'ferme');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable, déjà résolu ou non confié à un intervenant extérieur';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.cloturer_ticket_exterieur(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cloturer_ticket_exterieur(uuid, text, boolean) TO authenticated;
