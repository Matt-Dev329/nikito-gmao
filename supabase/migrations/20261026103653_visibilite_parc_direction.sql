-- Directeurs de parc et managers principaux (badge MGR) : voient tout ce qui
-- se passe dans leur parc.
-- - Commandes : toutes les commandes passées pour leur parc (et leurs
--   lignes), en lecture.
-- - Tickets : le manager principal voit aussi les tickets sans équipement
--   de son parc (comme le directeur de parc), dont ceux en attente de
--   validation.

-- Parc dont l'utilisateur est directeur ou manager principal
CREATE OR REPLACE FUNCTION public.voit_tout_le_parc(p_parc uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT p_parc IS NOT NULL AND CASE (SELECT current_role_code())
    WHEN 'directeur_parc' THEN p_parc = ANY (current_parc_ids())
    WHEN 'manager_parc' THEN p_parc = ANY (parcs_manager_principal())
    ELSE false
  END;
$function$;
REVOKE ALL ON FUNCTION public.voit_tout_le_parc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voit_tout_le_parc(uuid) TO authenticated;

ALTER POLICY "Demandeur ou gestionnaire lit les commandes" ON public.commandes
  USING ((demandeur_id = (SELECT current_utilisateur_id()))
         OR (SELECT est_gestionnaire_commandes())
         OR (directe AND est_destinataire_commande(id))
         OR voit_tout_le_parc(parc_id));

ALTER POLICY "Lecture des lignes selon la commande" ON public.commande_lignes
  USING (EXISTS (
    SELECT 1 FROM commandes c
    WHERE c.id = commande_lignes.commande_id
      AND ((c.demandeur_id = (SELECT current_utilisateur_id()))
           OR (SELECT est_gestionnaire_commandes())
           OR (c.directe AND est_destinataire_commande(c.id))
           OR voit_tout_le_parc(c.parc_id))));

ALTER POLICY inc_manager_parc_lecture ON public.incidents
  USING (((SELECT current_role_code()) = 'manager_parc'::role_utilisateur)
         AND ((equipement_id IN (SELECT equipements.id FROM equipements
                                 WHERE equipements.parc_id = ANY (current_parc_ids())))
              OR ((equipement_id IS NULL)
                  AND (parcs_du_ticket(id) && parcs_manager_principal()))));
