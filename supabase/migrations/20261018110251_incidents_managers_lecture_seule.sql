-- Managers de parc : lecture seule sur les tickets de leurs parcs. Le
-- signalement passe par la fonction creer-incident-signalement, la validation
-- et le refus par les RPC valider_ticket / supprimer_ticket.
CREATE POLICY inc_manager_parc_lecture ON public.incidents
  FOR SELECT TO authenticated
  USING (((SELECT current_role_code()) = 'manager_parc'::role_utilisateur)
         AND (equipement_id IN (SELECT equipements.id FROM equipements
                                WHERE equipements.parc_id = ANY (current_parc_ids()))));

-- L'ancienne règle (lecture + écriture) ne donne plus rien
ALTER POLICY inc_manager_parc ON public.incidents USING (false) WITH CHECK (false);
