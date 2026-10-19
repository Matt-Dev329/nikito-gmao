-- Activités exclues pour un technicien (ex. Samy et Baptiste : pas d'arcade).
-- Complète « specialites » (activités suivies) : un ticket d'une catégorie
-- exclue n'est ni visible (sauf s'il lui est assigné) ni notifié.
ALTER TABLE public.utilisateurs ADD COLUMN IF NOT EXISTS specialites_exclues uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.current_specialites_exclues()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((SELECT specialites_exclues FROM utilisateurs WHERE auth_user_id = (SELECT auth.uid())), '{}'::uuid[]);
$function$;
REVOKE ALL ON FUNCTION public.current_specialites_exclues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_specialites_exclues() TO authenticated;

ALTER POLICY inc_direction_total ON public.incidents
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND ((equipement_id IN (SELECT e.id FROM equipements e
                                     WHERE e.parc_id = ANY (current_parc_ids())
                                       AND (cardinality((SELECT current_specialites())) = 0
                                            OR e.categorie_id = ANY (current_specialites()))
                                       AND NOT coalesce(e.categorie_id = ANY (current_specialites_exclues()), false)))
                  OR (assigne_a_id = (SELECT current_utilisateur_id()))
                  OR ((equipement_id IS NULL)
                      AND cardinality((SELECT current_specialites())) = 0
                      AND ((declare_par_id = (SELECT current_utilisateur_id()))
                           OR (parcs_de_utilisateur(declare_par_id) && current_parc_ids()))))));

-- Samy Neki et Baptiste Jeanneau : pas d'arcade
UPDATE public.utilisateurs
SET specialites_exclues = ARRAY['528abb79-8a0d-4d9e-9cad-146565b2dc43'::uuid]
WHERE id IN ('317c6ac9-dc3f-41cb-85a8-7d8032a4de42', 'ba3b3aba-484c-4b31-a8e8-1dde2142dee0');
