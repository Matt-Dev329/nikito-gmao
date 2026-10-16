/*
  # Chacun ne voit que ses parcs (directeurs de parc, techniciens)

  Jusqu'ici les directeurs de parc et les techniciens voyaient les tickets,
  interventions, équipements et contrôles de tous les parcs. Désormais :
  - direction, chef d'équipe (et admin IT via ses propres règles) : tous
    les parcs ;
  - directeur de parc, technicien : uniquement les parcs qui leur sont
    attribués (parcs_utilisateurs) — plusieurs parcs si on leur en a
    attribué plusieurs ; un ticket qui leur est assigné reste visible ;
  - ticket sans équipement : visible s'il a été déclaré par une personne
    d'un de leurs parcs (ou par eux-mêmes), ou s'il leur est assigné ;
  - interventions : visibles seulement si le ticket l'est (lecture comprise,
    qui était ouverte à tous).
  Managers et staff : inchangés (déjà limités à leur parc).
*/

CREATE OR REPLACE FUNCTION public.parcs_de_utilisateur(p_utilisateur_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(parc_id), '{}') FROM parcs_utilisateurs WHERE utilisateur_id = p_utilisateur_id;
$$;
REVOKE EXECUTE ON FUNCTION public.parcs_de_utilisateur(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parcs_de_utilisateur(uuid) TO authenticated;

ALTER POLICY inc_direction_total ON public.incidents
USING (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR (
    (SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[])
    AND (
      equipement_id IN (SELECT e.id FROM equipements e WHERE e.parc_id = ANY (current_parc_ids()))
      OR assigne_a_id = (SELECT current_utilisateur_id())
      OR (equipement_id IS NULL AND (
        declare_par_id = (SELECT current_utilisateur_id())
        OR parcs_de_utilisateur(declare_par_id) && current_parc_ids()
      ))
    )
  )
)
WITH CHECK (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR (
    (SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[])
    AND (
      equipement_id IS NULL
      OR equipement_id IN (SELECT e.id FROM equipements e WHERE e.parc_id = ANY (current_parc_ids()))
      OR assigne_a_id = (SELECT current_utilisateur_id())
    )
  )
);

ALTER POLICY equip_direction_total ON public.equipements
USING (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR ((SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[]) AND parc_id = ANY (current_parc_ids()))
)
WITH CHECK (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR ((SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[]) AND parc_id = ANY (current_parc_ids()))
);

ALTER POLICY interv_ecriture_techniciens ON public.interventions
USING (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR ((SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[]) AND EXISTS (SELECT 1 FROM incidents i WHERE i.id = incident_id))
)
WITH CHECK (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR ((SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'technicien']::role_utilisateur[]) AND EXISTS (SELECT 1 FROM incidents i WHERE i.id = incident_id))
);

ALTER POLICY interv_lecture_authentifies ON public.interventions
USING (EXISTS (SELECT 1 FROM incidents i WHERE i.id = incident_id));

ALTER POLICY ctrl_select_direction_cm ON public.controles
USING (
  (SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[])
  OR ((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur AND parc_id = ANY (current_parc_ids()))
);

ALTER POLICY audit_select_direction_cm ON public.controles_audit_log
USING ((SELECT current_role_code()) = ANY (ARRAY['direction', 'chef_maintenance']::role_utilisateur[]));

ALTER POLICY audit_select_par_parc ON public.controles_audit_log
USING (
  (SELECT current_role_code()) = ANY (ARRAY['directeur_parc', 'manager_parc', 'technicien', 'staff_operationnel']::role_utilisateur[])
  AND EXISTS (SELECT 1 FROM controles c WHERE c.id = controles_audit_log.controle_id AND c.parc_id = ANY (current_parc_ids()))
);