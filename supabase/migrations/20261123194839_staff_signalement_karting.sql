-- Staff autorisé à créer des tickets, uniquement pour le karting (compte par
-- compte). Les autres staff ne créent toujours pas de tickets.
ALTER TABLE public.utilisateurs
  ADD COLUMN signalement_karting boolean NOT NULL DEFAULT false;

-- Seuls le chef d'équipe, la direction et l'admin IT accordent ce droit
CREATE OR REPLACE FUNCTION public.fn_utilisateurs_signalement_karting_protege()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.signalement_karting IS DISTINCT FROM OLD.signalement_karting
     AND current_utilisateur_id() IS NOT NULL
     AND coalesce(current_role_code()::text, '') NOT IN ('chef_maintenance', 'direction', 'admin_it') THEN
    RAISE EXCEPTION 'Seuls le chef d''équipe, la direction et l''admin IT donnent le droit de signaler le karting'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER utilisateurs_signalement_karting_protege BEFORE UPDATE ON public.utilisateurs
  FOR EACH ROW EXECUTE FUNCTION fn_utilisateurs_signalement_karting_protege();

-- Lu par la tablette (staff connecté par code PIN, sans compte)
CREATE OR REPLACE FUNCTION public.staff_signalement_karting(p_utilisateur uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((SELECT signalement_karting AND actif FROM utilisateurs WHERE id = p_utilisateur), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.staff_signalement_karting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_signalement_karting(uuid) TO anon, authenticated;

UPDATE public.utilisateurs SET signalement_karting = true
WHERE id IN ('521c570d-8141-40ab-b0c2-5b3760eb0081', '5facb8dd-c749-4ee0-8a3d-bf2cdd83b816');
