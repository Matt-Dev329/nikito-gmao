-- Demandes prestataires : droit de LECTURE seule accordé à un compte précis
-- (ex. un technicien), sur ses parcs. Création / modification inchangées
-- (direction, chef d'équipe, admin IT, directeurs, managers principaux).
ALTER TABLE public.utilisateurs
  ADD COLUMN lecture_demandes_prestataires boolean NOT NULL DEFAULT false;

-- Seuls le chef d'équipe, la direction et l'admin IT accordent ce droit
CREATE OR REPLACE FUNCTION public.fn_utilisateurs_lecture_demandes_protegee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.lecture_demandes_prestataires IS DISTINCT FROM OLD.lecture_demandes_prestataires
     AND current_utilisateur_id() IS NOT NULL
     AND coalesce(current_role_code()::text, '') NOT IN ('chef_maintenance', 'direction', 'admin_it') THEN
    RAISE EXCEPTION 'Seuls le chef d''équipe, la direction et l''admin IT donnent l''accès aux demandes prestataires'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER utilisateurs_lecture_demandes_protegee BEFORE UPDATE ON public.utilisateurs
  FOR EACH ROW EXECUTE FUNCTION fn_utilisateurs_lecture_demandes_protegee();

-- Lecture : accès complet OU droit de lecture sur ses parcs
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
                      WHERE u.auth_user_id = auth.uid() AND u.actif AND u.lecture_demandes_prestataires));
$function$;
REVOKE EXECUTE ON FUNCTION public.lecture_demandes_prestataires(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lecture_demandes_prestataires(uuid) TO authenticated;

ALTER POLICY demandes_prestataires_lecture ON public.demandes_prestataires
  USING (lecture_demandes_prestataires(parc_id));

-- Pièces jointes des demandes (alba-techniques/demande/<PARC>/…) : lecture aussi
CREATE POLICY alba_demandes_lecture_seule ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'alba-techniques'
         AND name LIKE 'demande/%'
         AND lecture_demandes_prestataires(
               coalesce((SELECT id FROM public.parcs WHERE code = split_part(name, '/', 2)),
                        '00000000-0000-0000-0000-000000000000'::uuid)));

-- Samy (technicien) : lecture seule des demandes prestataires de ses parcs
UPDATE public.utilisateurs SET lecture_demandes_prestataires = true
 WHERE id = '317c6ac9-dc3f-41cb-85a8-7d8032a4de42';