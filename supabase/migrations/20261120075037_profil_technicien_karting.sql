-- Nouveau type de technicien « Karting » : ne voit que les tickets des
-- équipements Karting (karts, bornes de recharge) et le stock Karting.
ALTER TABLE public.utilisateurs
  DROP CONSTRAINT utilisateurs_profil_technicien_check,
  ADD CONSTRAINT utilisateurs_profil_technicien_check
    CHECK (profil_technicien = ANY (ARRAY['polyvalent'::text, 'arcade'::text, 'nikito'::text, 'karting'::text]));
ALTER TABLE public.invitations
  DROP CONSTRAINT invitations_profil_technicien_check,
  ADD CONSTRAINT invitations_profil_technicien_check
    CHECK (profil_technicien = ANY (ARRAY['polyvalent'::text, 'arcade'::text, 'nikito'::text, 'karting'::text]));

CREATE OR REPLACE FUNCTION public.categories_karting()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(id), '{}') FROM categories_equipement WHERE activite ILIKE 'karting';
$function$;
REVOKE EXECUTE ON FUNCTION public.categories_karting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.categories_karting() TO authenticated;

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
    specialites_exclues = CASE WHEN p_profil = 'nikito' THEN v_arcade ELSE '{}' END
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
      specialites_exclues = CASE WHEN NEW.profil_technicien = 'nikito' THEN v_arcade ELSE '{}' END
    FROM roles r
    WHERE u.id = NEW.utilisateur_cree_id AND r.id = u.role_id AND r.code = 'technicien';
  END IF;
  RETURN NEW;
END;
$function$;

-- Stock : le technicien Karting ne voit que les pièces de l'activité Karting
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
  ), karting AS (
    SELECT id FROM commande_activites WHERE nom = 'Karting' LIMIT 1
  )
  SELECT CASE (SELECT profil_technicien FROM moi)
    WHEN 'arcade' THEN p_activite_id IS NOT DISTINCT FROM (SELECT id FROM arcade) AND p_activite_id IS NOT NULL
    WHEN 'nikito' THEN p_activite_id IS DISTINCT FROM (SELECT id FROM arcade)
    WHEN 'karting' THEN p_activite_id IS NOT DISTINCT FROM (SELECT id FROM karting) AND p_activite_id IS NOT NULL
    ELSE true
  END;
$function$;