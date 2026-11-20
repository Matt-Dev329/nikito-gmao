-- Technicien Karting : n'a accès qu'au karting, y compris pour commander
-- (activité « Karting » seulement ; les produits suivent leur activité).
CREATE OR REPLACE FUNCTION public.est_technicien_karting()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid() AND r.code = 'technicien' AND u.profil_technicien = 'karting'
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.est_technicien_karting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_technicien_karting() TO authenticated;

CREATE POLICY commande_activites_karting_seul ON public.commande_activites AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (NOT (SELECT est_technicien_karting()) OR nom = 'Karting');