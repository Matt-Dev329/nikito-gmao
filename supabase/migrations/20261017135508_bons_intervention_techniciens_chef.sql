-- Bons d'intervention : réservés aux techniciens et au chef d'équipe
-- (direction et admin IT gardent l'accès complet) ; plus les directeurs ni managers.
ALTER POLICY bons_intervention_lecture ON public.bons_intervention
  USING (((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'admin_it']))
         OR (((SELECT current_role_code())::text = 'technicien')
             AND ((parc_id IS NULL) OR (parc_id = ANY (current_parc_ids())) OR (cree_par_id = (SELECT current_utilisateur_id())))));
ALTER POLICY bons_intervention_ajout ON public.bons_intervention
  WITH CHECK (((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'technicien', 'admin_it']))
              AND (cree_par_id = (SELECT current_utilisateur_id())));
ALTER POLICY bons_intervention_retrait ON public.bons_intervention
  USING ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'admin_it']))
  WITH CHECK ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'admin_it']));
ALTER POLICY alba_bons_lecture ON storage.objects
  USING ((bucket_id = 'alba-bons') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'technicien', 'admin_it'])));
ALTER POLICY alba_bons_ajout ON storage.objects
  WITH CHECK ((bucket_id = 'alba-bons') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'technicien', 'admin_it'])));