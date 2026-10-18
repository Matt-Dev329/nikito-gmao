-- Les emails des comptes sont toujours enregistrés en minuscules : le code de
-- vérification (codes_2fa) est comparé à l'email de la session, en minuscules.
-- Un email saisi avec une majuscule faisait refuser l'enregistrement du code.
CREATE OR REPLACE FUNCTION public.fn_email_utilisateur_minuscules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_email_utilisateur_minuscules
  BEFORE INSERT OR UPDATE OF email ON public.utilisateurs
  FOR EACH ROW EXECUTE FUNCTION public.fn_email_utilisateur_minuscules();

UPDATE public.utilisateurs SET email = lower(trim(email))
WHERE email IS NOT NULL AND email <> lower(trim(email));
