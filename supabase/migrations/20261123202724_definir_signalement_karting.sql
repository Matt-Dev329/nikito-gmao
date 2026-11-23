-- Case « Peut signaler les pannes du karting » (staff) dans la fiche utilisateur
CREATE OR REPLACE FUNCTION public.definir_signalement_karting(p_utilisateur_id uuid, p_autorise boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce((SELECT current_role_code())::text, '') NOT IN ('direction', 'chef_maintenance', 'admin_it') THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe, à la direction et à l''admin IT' USING ERRCODE = '42501';
  END IF;
  UPDATE utilisateurs SET signalement_karting = coalesce(p_autorise, false) WHERE id = p_utilisateur_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.definir_signalement_karting(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_signalement_karting(uuid, boolean) TO authenticated;
