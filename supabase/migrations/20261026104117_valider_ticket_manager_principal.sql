-- Validation / refus / suppression des tickets : les managers principaux
-- (badge MGR) le peuvent aussi, sur les parcs où ils ont le badge.

CREATE OR REPLACE FUNCTION public.peut_valider_ticket(p_incident_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
SELECT CASE (SELECT current_role_code())
  WHEN 'direction' THEN true
  WHEN 'chef_maintenance' THEN true
  WHEN 'admin_it' THEN true
  WHEN 'directeur_parc' THEN parcs_du_ticket(p_incident_id) && current_parc_ids()
  WHEN 'manager_parc' THEN parcs_du_ticket(p_incident_id) && parcs_manager_principal()
  ELSE false
END;
$function$;
