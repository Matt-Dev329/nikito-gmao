-- Invitations en double : quand une invitation est acceptée, les autres
-- invitations en attente pour le même email sont fermées. Les emails
-- d'invitation sont enregistrés en minuscules.
CREATE OR REPLACE FUNCTION public.fn_invitation_email_minuscules()
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

CREATE TRIGGER trg_invitation_email_minuscules
  BEFORE INSERT OR UPDATE OF email ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.fn_invitation_email_minuscules();

CREATE OR REPLACE FUNCTION public.fn_fermer_invitations_doublons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.utilise_le IS NOT NULL AND OLD.utilise_le IS NULL AND NEW.email IS NOT NULL THEN
    UPDATE invitations
    SET utilise_le = now(),
        notes = coalesce(notes || ' · ', '') || 'Fermée : compte déjà créé avec une autre invitation'
    WHERE id <> NEW.id
      AND utilise_le IS NULL
      AND lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_fermer_invitations_doublons() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_fermer_invitations_doublons
  AFTER UPDATE OF utilise_le ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.fn_fermer_invitations_doublons();

-- Rattrapage : invitations en attente de personnes qui ont déjà un compte actif
UPDATE public.invitations i
SET utilise_le = now(),
    notes = coalesce(i.notes || ' · ', '') || 'Fermée : compte déjà créé avec une autre invitation'
WHERE i.utilise_le IS NULL
  AND i.email IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.utilisateurs u WHERE lower(u.email) = lower(i.email) AND u.actif);

UPDATE public.invitations SET email = lower(trim(email))
WHERE email IS NOT NULL AND email <> lower(trim(email));
