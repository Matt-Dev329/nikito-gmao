-- Onglets de pilotage (rapports et analyses prestataires, formations du
-- personnel, certifications, préventif) : direction, chef d'équipe et admin IT
-- partout ; directeurs de parc et managers principaux (est_manager) sur leurs
-- parcs ; jamais les managers non principaux.

CREATE OR REPLACE FUNCTION public.parcs_manager_principal()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
SELECT COALESCE(array_agg(pu.parc_id), ARRAY[]::uuid[])
FROM parcs_utilisateurs pu
JOIN utilisateurs u ON u.id = pu.utilisateur_id
JOIN roles r ON r.id = u.role_id
WHERE u.auth_user_id = auth.uid() AND r.code = 'manager_parc' AND pu.est_manager AND u.actif;
$function$;

-- p_parc NULL = document commun à tous les parcs
CREATE OR REPLACE FUNCTION public.acces_pilotage_parc(p_parc uuid)
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
  WHEN 'directeur_parc' THEN p_parc IS NULL OR p_parc = ANY (current_parc_ids())
  WHEN 'manager_parc' THEN cardinality(parcs_manager_principal()) > 0
                           AND (p_parc IS NULL OR p_parc = ANY (parcs_manager_principal()))
  ELSE false
END;
$function$;

REVOKE ALL ON FUNCTION public.parcs_manager_principal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acces_pilotage_parc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parcs_manager_principal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acces_pilotage_parc(uuid) TO authenticated;

-- Rapports prestataires
ALTER POLICY documents_techniques_lecture ON public.documents_techniques
  USING (((type <> 'prestataire') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','manager_parc','technicien','admin_it'])))
         OR ((type = 'prestataire') AND acces_pilotage_parc(parc_id)));
ALTER POLICY documents_techniques_ajout ON public.documents_techniques
  WITH CHECK (((type <> 'prestataire') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','admin_it'])))
         OR ((type = 'prestataire') AND acces_pilotage_parc(parc_id)));
ALTER POLICY documents_techniques_modification ON public.documents_techniques
  USING (((type <> 'prestataire') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','admin_it'])))
         OR ((type = 'prestataire') AND acces_pilotage_parc(parc_id)))
  WITH CHECK (((type <> 'prestataire') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','admin_it'])))
         OR ((type = 'prestataire') AND acces_pilotage_parc(parc_id)));

-- Analyses prestataires
ALTER POLICY analyses_prestataires_lecture ON public.analyses_rapports_prestataires
  USING (EXISTS (SELECT 1 FROM documents_techniques d
                 WHERE d.id = analyses_rapports_prestataires.document_id AND acces_pilotage_parc(d.parc_id)));

-- Formations du personnel
ALTER POLICY formations_personnel_lecture ON public.formations_personnel USING (acces_pilotage_parc(parc_id));
ALTER POLICY formations_personnel_ajout ON public.formations_personnel
  WITH CHECK (acces_pilotage_parc(parc_id) AND (parc_id IS NOT NULL OR (SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','admin_it'])));
ALTER POLICY formations_personnel_modification ON public.formations_personnel
  USING (acces_pilotage_parc(parc_id))
  WITH CHECK (acces_pilotage_parc(parc_id) AND (parc_id IS NOT NULL OR (SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','admin_it'])));

-- Certifications et préventif : écriture selon le parc de l'équipement
ALTER POLICY certifs_ecriture_admin ON public.certifications
  USING (acces_pilotage_parc((SELECT e.parc_id FROM equipements e WHERE e.id = certifications.equipement_id)))
  WITH CHECK (acces_pilotage_parc((SELECT e.parc_id FROM equipements e WHERE e.id = certifications.equipement_id)));
ALTER POLICY preventif_ecriture_admin ON public.maintenances_preventives
  USING (acces_pilotage_parc((SELECT e.parc_id FROM equipements e WHERE e.id = maintenances_preventives.equipement_id)))
  WITH CHECK (acces_pilotage_parc((SELECT e.parc_id FROM equipements e WHERE e.id = maintenances_preventives.equipement_id)));

-- Fichiers
ALTER POLICY alba_techniques_lecture ON storage.objects
  USING ((bucket_id = 'alba-techniques') AND (((name !~~ 'prestataire/%') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','manager_parc','technicien','admin_it'])))
         OR ((name ~~ 'prestataire/%') AND acces_pilotage_parc(NULL))));
ALTER POLICY alba_techniques_ajout ON storage.objects
  WITH CHECK ((bucket_id = 'alba-techniques') AND (((name !~~ 'prestataire/%') AND ((SELECT current_role_code())::text = ANY (ARRAY['direction','chef_maintenance','directeur_parc','manager_parc','technicien','admin_it'])))
         OR ((name ~~ 'prestataire/%') AND acces_pilotage_parc(NULL))));
ALTER POLICY alba_formations_lecture ON storage.objects
  USING ((bucket_id = 'alba-formations') AND acces_pilotage_parc(NULL));
ALTER POLICY alba_formations_ajout ON storage.objects
  WITH CHECK ((bucket_id = 'alba-formations') AND acces_pilotage_parc(NULL));