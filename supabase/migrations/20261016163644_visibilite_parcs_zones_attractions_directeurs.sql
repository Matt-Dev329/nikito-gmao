-- Directeurs de parc : zones et attractions de leurs parcs uniquement
ALTER POLICY zones_ecriture_admin ON public.zones
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))));
ALTER POLICY attractions_ecriture_admin ON public.parc_attractions
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))));