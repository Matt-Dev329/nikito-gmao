-- Demandes prestataires :
-- - création / modification ouvertes à tous les managers de parc (sur leurs parcs) ;
-- - lecture ouverte aux techniciens Nikito (sur leurs parcs).
CREATE OR REPLACE FUNCTION public.acces_demandes_prestataires(p_parc uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT acces_direction_parc(p_parc)
      OR (p_parc IS NOT NULL AND p_parc = ANY (parcs_manager_principal()))
      OR (p_parc IS NOT NULL
          AND coalesce(current_role_code()::text = 'manager_parc', false)
          AND p_parc = ANY (current_parc_ids()));
$function$;

CREATE OR REPLACE FUNCTION public.lecture_demandes_prestataires(p_parc uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT acces_demandes_prestataires(p_parc)
      OR (p_parc IS NOT NULL
          AND p_parc = ANY (current_parc_ids())
          AND EXISTS (SELECT 1 FROM utilisateurs u
                      WHERE u.auth_user_id = auth.uid() AND u.actif
                        AND (u.lecture_demandes_prestataires
                             OR (u.profil_technicien = 'nikito' AND coalesce(current_role_code()::text = 'technicien', false)))));
$function$;
