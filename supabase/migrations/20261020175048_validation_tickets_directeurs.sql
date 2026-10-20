-- Validation et suppression des tickets : réservées au chef d'équipe, à la
-- direction, à l'admin IT et aux directeurs de parc (sur leurs parcs). Les
-- managers principaux ne valident plus et ne suppriment plus de tickets.
-- (valider_ticket et supprimer_ticket s'appuient sur peut_valider_ticket)

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
  ELSE false
END;
$function$;
