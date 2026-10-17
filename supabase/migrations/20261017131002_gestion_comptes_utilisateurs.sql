-- Comptes (suite de gestion_comptes_hauteur_grade) : droits d'écriture sur la table utilisateurs

-- Comptes : direction, admin IT et chef d'équipe en écriture sur tous les comptes
ALTER POLICY user_direction_all ON public.utilisateurs
  USING ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'admin_it'::role_utilisateur]))
  WITH CHECK ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'admin_it'::role_utilisateur]));

-- Directeurs et managers : lecture des comptes de leurs parcs
ALTER POLICY manager_parc_select_same_parc_users ON public.utilisateurs
  USING (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
         AND (parcs_de_utilisateur(id) && current_parc_ids()));

-- Directeurs et managers : modification des comptes à leur hauteur (désactiver, réactiver…)
ALTER POLICY manager_parc_update_staff ON public.utilisateurs
  USING (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
         AND peut_gerer_utilisateur(id))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
         AND peut_gerer_compte((SELECT r.code FROM roles r WHERE r.id = utilisateurs.role_id), parcs_de_utilisateur(id)));

-- Son propre compte : profil modifiable, mais pas son rôle
ALTER POLICY user_self_update ON public.utilisateurs
  WITH CHECK ((auth_user_id = (SELECT auth.uid()))
              AND role_id = (SELECT u.role_id FROM utilisateurs u WHERE u.auth_user_id = (SELECT auth.uid())));