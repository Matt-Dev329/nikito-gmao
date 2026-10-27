-- Déconnexion automatique après une période d'inactivité, compte par compte
-- (null = pas de déconnexion automatique). Réglée seulement par le chef
-- d'équipe, la direction ou l'admin IT. Première utilisation : Alexandre
-- Djurdjevic, 10 minutes (demande du 27/10).

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS deconnexion_inactivite_min smallint
  CHECK (deconnexion_inactivite_min IS NULL OR deconnexion_inactivite_min BETWEEN 1 AND 1440);

CREATE OR REPLACE FUNCTION public.fn_utilisateurs_deconnexion_protegee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.deconnexion_inactivite_min IS DISTINCT FROM OLD.deconnexion_inactivite_min
     AND current_utilisateur_id() IS NOT NULL
     AND coalesce(current_role_code()::text, '') NOT IN ('chef_maintenance', 'direction', 'admin_it') THEN
    RAISE EXCEPTION 'Seuls le chef d''équipe, la direction et l''admin IT règlent la déconnexion automatique'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER utilisateurs_deconnexion_protegee BEFORE UPDATE ON public.utilisateurs
  FOR EACH ROW EXECUTE FUNCTION fn_utilisateurs_deconnexion_protegee();

UPDATE public.utilisateurs SET deconnexion_inactivite_min = 10
WHERE lower(email) = 'alexandre.djurdjevic@nikito.com';
