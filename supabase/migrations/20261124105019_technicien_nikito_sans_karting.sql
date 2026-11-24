-- Technicien Nikito : tout sauf les arcades ET le karting (tickets,
-- notifications, équipements suivent specialites_exclues).
CREATE OR REPLACE FUNCTION public.definir_profil_technicien(p_utilisateur_id uuid, p_profil text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_arcade uuid[] := categories_arcade();
  v_karting uuid[] := categories_karting();
BEGIN
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'admin_it') THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  IF p_profil NOT IN ('polyvalent', 'arcade', 'nikito', 'karting') THEN
    RAISE EXCEPTION 'Profil inconnu : %', p_profil;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.id = p_utilisateur_id AND r.code = 'technicien'
  ) THEN
    RAISE EXCEPTION 'Le profil ne s''applique qu''aux techniciens';
  END IF;
  UPDATE utilisateurs SET
    profil_technicien = p_profil,
    specialites = CASE p_profil WHEN 'arcade' THEN v_arcade WHEN 'karting' THEN v_karting ELSE '{}' END,
    specialites_exclues = CASE WHEN p_profil = 'nikito' THEN v_arcade || v_karting ELSE '{}' END
  WHERE id = p_utilisateur_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_profil_technicien_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_arcade uuid[] := categories_arcade();
  v_karting uuid[] := categories_karting();
BEGIN
  IF NEW.utilisateur_cree_id IS NOT NULL AND NEW.profil_technicien <> 'polyvalent'
     AND OLD.utilisateur_cree_id IS DISTINCT FROM NEW.utilisateur_cree_id THEN
    UPDATE utilisateurs u SET
      profil_technicien = NEW.profil_technicien,
      specialites = CASE NEW.profil_technicien WHEN 'arcade' THEN v_arcade WHEN 'karting' THEN v_karting ELSE '{}' END,
      specialites_exclues = CASE WHEN NEW.profil_technicien = 'nikito' THEN v_arcade || v_karting ELSE '{}' END
    FROM roles r
    WHERE u.id = NEW.utilisateur_cree_id AND r.id = u.role_id AND r.code = 'technicien';
  END IF;
  RETURN NEW;
END;
$function$;

-- Techniciens Nikito existants
UPDATE public.utilisateurs
SET specialites_exclues = categories_arcade() || categories_karting()
WHERE profil_technicien = 'nikito';
