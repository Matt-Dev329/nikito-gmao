/*
  # Lot 3 - RPCs pour reassignement, pause et validation des tickets

  ## Description
  Suite a l'ajout du schema, on cree les RPCs SECURITY DEFINER permettant de :
  - reassigner un incident a un autre technicien
  - mettre un incident en pause / le reprendre
  - valider un brouillon (passage en statut 'ouvert')
*/

CREATE OR REPLACE FUNCTION public.reassigner_incident(
  p_incident_id uuid,
  p_nouveau_technicien_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;

BEGIN
  SELECT r.code INTO v_role
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();


  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorise a reassigner un ticket' USING ERRCODE = '42501';

  END IF;


  UPDATE incidents
  SET assigne_a_id = p_nouveau_technicien_id,
      statut = CASE WHEN statut = 'ouvert' THEN 'assigne'::statut_incident ELSE statut END,
      modifie_le = NOW()
  WHERE id = p_incident_id;

END;

$function$;


CREATE OR REPLACE FUNCTION public.mettre_en_pause_incident(
  p_incident_id uuid,
  p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;

BEGIN
  SELECT r.code INTO v_role
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();


  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorise a mettre un ticket en pause' USING ERRCODE = '42501';

  END IF;


  UPDATE incidents
  SET statut = 'en_pause'::statut_incident,
      pause_motif = p_motif,
      pause_depuis = NOW(),
      modifie_le = NOW()
  WHERE id = p_incident_id;

END;

$function$;


CREATE OR REPLACE FUNCTION public.reprendre_incident(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;

BEGIN
  SELECT r.code INTO v_role
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();


  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorise a reprendre un ticket' USING ERRCODE = '42501';

  END IF;


  UPDATE incidents
  SET statut = CASE
        WHEN assigne_a_id IS NOT NULL THEN 'en_cours'::statut_incident
        ELSE 'ouvert'::statut_incident
      END,
      pause_motif = NULL,
      pause_depuis = NULL,
      modifie_le = NOW()
  WHERE id = p_incident_id AND statut = 'en_pause';

END;

$function$;


CREATE OR REPLACE FUNCTION public.valider_brouillon_incident(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;

BEGIN
  SELECT r.code INTO v_role
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();


  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorise a valider un brouillon' USING ERRCODE = '42501';

  END IF;


  UPDATE incidents
  SET est_brouillon = false,
      statut = 'ouvert'::statut_incident,
      modifie_le = NOW()
  WHERE id = p_incident_id AND est_brouillon = true;

END;

$function$;


REVOKE ALL ON FUNCTION public.reassigner_incident FROM PUBLIC;

REVOKE ALL ON FUNCTION public.mettre_en_pause_incident FROM PUBLIC;

REVOKE ALL ON FUNCTION public.reprendre_incident FROM PUBLIC;

REVOKE ALL ON FUNCTION public.valider_brouillon_incident FROM PUBLIC;


GRANT EXECUTE ON FUNCTION public.reassigner_incident TO authenticated;

GRANT EXECUTE ON FUNCTION public.mettre_en_pause_incident TO authenticated;

GRANT EXECUTE ON FUNCTION public.reprendre_incident TO authenticated;

GRANT EXECUTE ON FUNCTION public.valider_brouillon_incident TO authenticated;

;
