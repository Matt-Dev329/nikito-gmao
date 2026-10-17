-- Managers : le staff visible se limite à leurs parcs (voyaient le staff de tous les parcs)
ALTER POLICY manager_parc_select_staff ON public.utilisateurs
  USING (((SELECT current_role_code()) = 'manager_parc'::role_utilisateur)
         AND (parcs_de_utilisateur(id) && current_parc_ids()));