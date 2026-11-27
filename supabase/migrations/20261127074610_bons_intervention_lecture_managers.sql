-- Directeurs de parc et managers : lecture des bons d'intervention de leurs parcs (et des photos / vidéos jointes)
DROP POLICY IF EXISTS bons_intervention_lecture ON public.bons_intervention;
CREATE POLICY bons_intervention_lecture ON public.bons_intervention FOR SELECT TO authenticated USING (
  ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','admin_it']))
  OR (((SELECT current_role_code())::text = 'technicien') AND ((parc_id IS NULL) OR (parc_id = ANY (current_parc_ids())) OR (cree_par_id = (SELECT current_utilisateur_id()))))
  OR (((SELECT current_role_code())::text = ANY (ARRAY['directeur_parc','manager_parc'])) AND (parc_id = ANY (current_parc_ids())))
);
DROP POLICY IF EXISTS alba_bons_lecture ON storage.objects;
CREATE POLICY alba_bons_lecture ON storage.objects FOR SELECT TO authenticated USING (
  (bucket_id = 'alba-bons') AND (
    ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','technicien','admin_it']))
    OR (((SELECT current_role_code())::text = ANY (ARRAY['directeur_parc','manager_parc']))
        AND EXISTS (SELECT 1 FROM public.bons_intervention b WHERE objects.name = ANY (b.medias) AND b.parc_id = ANY (current_parc_ids())))
  )
);
