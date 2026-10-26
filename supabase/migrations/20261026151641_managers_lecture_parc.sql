-- Tous les managers (pas seulement les principaux) voient, en lecture, tout
-- ce qui se passe dans leurs parcs : commandes (et lignes) et tickets, y
-- compris ceux sans équipement. Aucune action en plus : valider / refuser
-- reste au directeur et au manager principal (peut_valider_ticket),
-- intervenir reste soumis à peut_intervenir, traiter une commande au chef
-- d'équipe.

CREATE OR REPLACE FUNCTION public.voit_tout_le_parc(p_parc uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT p_parc IS NOT NULL AND CASE (SELECT current_role_code())
    WHEN 'directeur_parc' THEN p_parc = ANY (current_parc_ids())
    WHEN 'manager_parc' THEN p_parc = ANY (current_parc_ids())
    ELSE false
  END;
$function$;

ALTER POLICY inc_manager_parc_lecture ON public.incidents
  USING (((SELECT current_role_code()) = 'manager_parc'::role_utilisateur)
         AND ((equipement_id IN (SELECT equipements.id FROM equipements
                                 WHERE equipements.parc_id = ANY (current_parc_ids())))
              OR ((equipement_id IS NULL)
                  AND (parcs_du_ticket(id) && current_parc_ids()))));
