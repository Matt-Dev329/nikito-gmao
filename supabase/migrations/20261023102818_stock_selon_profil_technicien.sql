-- Stock selon le profil du technicien : un technicien Arcade ne voit que le
-- stock du domaine « Arcade », un technicien Nikito tout sauf l'Arcade
-- (polyvalents et autres rôles : inchangé).

CREATE OR REPLACE FUNCTION public.piece_visible_profil(p_activite_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  WITH moi AS (
    SELECT u.profil_technicien FROM utilisateurs u
    WHERE u.id = current_utilisateur_id() AND current_role_code()::text = 'technicien'
  ), arcade AS (
    SELECT id FROM commande_activites WHERE nom = 'Arcade' LIMIT 1
  )
  SELECT CASE (SELECT profil_technicien FROM moi)
    WHEN 'arcade' THEN p_activite_id IS NOT DISTINCT FROM (SELECT id FROM arcade) AND p_activite_id IS NOT NULL
    WHEN 'nikito' THEN p_activite_id IS DISTINCT FROM (SELECT id FROM arcade)
    ELSE true
  END;
$function$;
REVOKE ALL ON FUNCTION public.piece_visible_profil(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.piece_visible_profil(uuid) TO authenticated;

ALTER POLICY pieces_lecture_authentifies ON public.pieces_detachees
  USING (((parc_id IS NULL) OR (parc_id = ANY (current_parc_ids())) OR (SELECT peut_entrer_stock()))
         AND piece_visible_profil(activite_id));
