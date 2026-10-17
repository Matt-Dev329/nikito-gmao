-- Invitations : uniquement pour un rôle et des parcs à la hauteur de l'inviteur
ALTER POLICY invit_direction_total ON public.invitations
  USING (peut_gerer_compte((SELECT r.code FROM roles r WHERE r.id = invitations.role_id), coalesce(parcs_assignes, '{}'), coalesce(est_manager, false)))
  WITH CHECK (peut_gerer_compte((SELECT r.code FROM roles r WHERE r.id = invitations.role_id), coalesce(parcs_assignes, '{}'), coalesce(est_manager, false)));

-- Rattachement aux parcs
ALTER POLICY pu_ecriture_gestionnaires ON public.parcs_utilisateurs
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'admin_it'::role_utilisateur]))
         OR (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
             AND parc_id = ANY (current_parc_ids()) AND peut_gerer_utilisateur(utilisateur_id)))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'admin_it'::role_utilisateur]))
         OR (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
             AND parc_id = ANY (current_parc_ids()) AND peut_gerer_utilisateur(utilisateur_id)));
ALTER POLICY pu_lecture_admin ON public.parcs_utilisateurs
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'admin_it'::role_utilisateur]))
         OR (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
             AND parcs_de_utilisateur(utilisateur_id) && current_parc_ids())
         OR (utilisateur_id = (SELECT current_utilisateur_id())));