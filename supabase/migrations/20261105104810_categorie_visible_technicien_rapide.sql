-- Visibilité d'une catégorie pour un technicien (spécialités / exclusions) :
-- une seule lecture de l'utilisateur au lieu de quatre appels de fonctions,
-- même résultat (vérifié pour chaque utilisateur et chaque catégorie). Elle
-- est évaluée pour chaque équipement par les règles d'accès : les listes de
-- tickets et de récurrences des techniciens dépassaient le délai maximal.
CREATE OR REPLACE FUNCTION public.categorie_visible_technicien(p_categorie uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT CASE WHEN rc.role_code::text IS DISTINCT FROM 'technicien' THEN true
      ELSE (cardinality(coalesce(u.specialites, '{}'::uuid[])) = 0 OR p_categorie = ANY (coalesce(u.specialites, '{}'::uuid[])))
           AND NOT coalesce(p_categorie = ANY (coalesce(u.specialites_exclues, '{}'::uuid[])), false) END
    FROM user_role_cache rc
    LEFT JOIN utilisateurs u ON u.auth_user_id = rc.auth_user_id
    WHERE rc.auth_user_id = (SELECT auth.uid())), true);
$function$;