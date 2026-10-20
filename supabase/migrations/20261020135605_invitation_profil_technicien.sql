-- Invitation d'un technicien : son type (Arcade / Nikito / polyvalent) est
-- choisi dès l'invitation et appliqué automatiquement quand il accepte.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS profil_technicien text NOT NULL DEFAULT 'polyvalent'
  CHECK (profil_technicien IN ('polyvalent', 'arcade', 'nikito'));

CREATE OR REPLACE FUNCTION public.fn_profil_technicien_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_arcade uuid[] := categories_arcade();
BEGIN
  IF NEW.utilisateur_cree_id IS NOT NULL AND NEW.profil_technicien <> 'polyvalent'
     AND OLD.utilisateur_cree_id IS DISTINCT FROM NEW.utilisateur_cree_id THEN
    UPDATE utilisateurs u SET
      profil_technicien = NEW.profil_technicien,
      specialites = CASE WHEN NEW.profil_technicien = 'arcade' THEN v_arcade ELSE '{}' END,
      specialites_exclues = CASE WHEN NEW.profil_technicien = 'nikito' THEN v_arcade ELSE '{}' END
    FROM roles r
    WHERE u.id = NEW.utilisateur_cree_id AND r.id = u.role_id AND r.code = 'technicien';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_profil_technicien_invitation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_profil_technicien_invitation
AFTER UPDATE OF utilisateur_cree_id ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.fn_profil_technicien_invitation();
