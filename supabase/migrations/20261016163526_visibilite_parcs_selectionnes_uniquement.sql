-- Chaque compte ne voit que les parcs sélectionnés dans son compte
-- (parcs_utilisateurs). La direction, le chef d'équipe et l'admin IT ont
-- les 4 parcs sélectionnés : rien ne change pour eux aujourd'hui.

-- Parcs : la lecture publique des parcs actifs reste pour l'écran de
-- connexion du staff (anon), plus pour les comptes connectés.
ALTER POLICY parcs_lecture_publique ON public.parcs TO anon;
ALTER POLICY tech_lecture_parcs ON public.parcs
  USING (((SELECT current_role_code()) = 'technicien'::role_utilisateur) AND (id = ANY (current_parc_ids())));
ALTER POLICY direction_total_access ON public.parcs
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (id = ANY (current_parc_ids()))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (id = ANY (current_parc_ids()))));

-- Données rattachées à un parc
ALTER POLICY auth_read_revenue ON public.parc_revenue USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY auth_read_attendance ON public.parc_attendance USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY plaintes_lecture_authentifies ON public.plaintes_clients USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY zones_lecture_authentifies ON public.zones USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY attractions_lecture_authentifies ON public.parc_attractions USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY archives_lecture_authentifies ON public.archives_pdf
  USING ((parc_id IS NULL) OR (parc_id = ANY (current_parc_ids())));
ALTER POLICY "Authenticated users can read controle manquant notifications" ON public.notifications_controle_manquant
  USING (parc_id = ANY (current_parc_ids()));
ALTER POLICY notes_direction_total ON public.notes_chantier
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids()))));