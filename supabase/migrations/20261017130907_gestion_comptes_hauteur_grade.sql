-- Gestion des comptes « à hauteur de grade » :
--  * direction, admin IT, chef d'équipe : tous les comptes, tous les parcs ;
--  * directeur de parc : directeurs, managers et staff de ses parcs ;
--  * manager de parc : managers et staff de ses parcs (badge MGR seulement
--    s'il est lui-même manager principal de ces parcs) ;
--  * technicien, staff : aucun.
-- Corrige au passage : un directeur de parc pouvait donner n'importe quel rôle
-- (direction comprise) via modifier_utilisateur ou une invitation.

-- Peut-on créer / mettre un compte avec ce rôle, ces parcs, ce badge MGR ?
CREATE OR REPLACE FUNCTION public.peut_gerer_compte(p_role role_utilisateur, p_parcs uuid[], p_est_manager boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
SELECT CASE (SELECT current_role_code())
  WHEN 'direction' THEN true
  WHEN 'admin_it' THEN true
  WHEN 'chef_maintenance' THEN true
  WHEN 'directeur_parc' THEN p_role IN ('directeur_parc', 'manager_parc', 'staff_operationnel')
                             AND cardinality(coalesce(p_parcs, '{}')) > 0
                             AND p_parcs <@ current_parc_ids()
  WHEN 'manager_parc' THEN p_role IN ('manager_parc', 'staff_operationnel')
                           AND cardinality(coalesce(p_parcs, '{}')) > 0
                           AND p_parcs <@ current_parc_ids()
                           AND (NOT coalesce(p_est_manager, false) OR p_parcs <@ parcs_manager_principal())
  ELSE false
END;
$function$;

-- Peut-on modifier ce compte existant (son rôle, ses parcs, son badge actuels) ?
CREATE OR REPLACE FUNCTION public.peut_gerer_utilisateur(p_utilisateur_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
SELECT coalesce((
  SELECT peut_gerer_compte(
    r.code,
    parcs_de_utilisateur(u.id),
    EXISTS (SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.est_manager))
  FROM utilisateurs u JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_utilisateur_id), false);
$function$;

REVOKE ALL ON FUNCTION public.peut_gerer_compte(role_utilisateur, uuid[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.peut_gerer_utilisateur(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_gerer_compte(role_utilisateur, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_gerer_utilisateur(uuid) TO authenticated;

-- Modification d'un compte : avant ET après doivent être à la hauteur de
-- l'appelant. L'ancienne fonction (qui fait la mise à jour) devient interne et
-- n'est plus appelable directement.
ALTER FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) RENAME TO modifier_utilisateur_base;
REVOKE ALL ON FUNCTION public.modifier_utilisateur_base(uuid, uuid, uuid[], boolean, boolean) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.modifier_utilisateur(p_utilisateur_id uuid, p_role_id uuid, p_parc_ids uuid[], p_est_manager boolean DEFAULT false, p_actif boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_cible role_utilisateur;
BEGIN
  SELECT code INTO v_role_cible FROM roles WHERE id = p_role_id;
  IF v_role_cible IS NULL THEN
    RAISE EXCEPTION 'Rôle introuvable';
  END IF;
  IF NOT peut_gerer_utilisateur(p_utilisateur_id) THEN
    RAISE EXCEPTION 'Ce compte est au-dessus de ton grade ou hors de tes parcs' USING ERRCODE = '42501';
  END IF;
  IF NOT peut_gerer_compte(v_role_cible, coalesce(p_parc_ids, '{}'), p_est_manager) THEN
    RAISE EXCEPTION 'Tu ne peux pas donner ce rôle, ce badge ou ces parcs' USING ERRCODE = '42501';
  END IF;
  PERFORM modifier_utilisateur_base(p_utilisateur_id, p_role_id, p_parc_ids, p_est_manager, p_actif);
END;
$function$;

REVOKE ALL ON FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) TO authenticated;

-- Création de staff PIN : même règle (admin IT compris)
CREATE OR REPLACE FUNCTION public.creer_staff_pin(p_prenom text, p_nom text, p_email text, p_parc_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moi uuid := (SELECT current_utilisateur_id());
  v_role_staff uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
BEGIN
  IF p_parc_ids IS NULL OR cardinality(p_parc_ids) = 0 THEN
    RAISE EXCEPTION 'Choisis au moins un parc';
  END IF;
  IF v_moi IS NULL OR NOT peut_gerer_compte('staff_operationnel', p_parc_ids) THEN
    RAISE EXCEPTION 'Tu ne peux rattacher le staff qu''à tes parcs';
  END IF;
  IF v_email IS NOT NULL THEN
    IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RAISE EXCEPTION 'Adresse mail invalide';
    END IF;
    IF EXISTS (SELECT 1 FROM utilisateurs WHERE lower(email) = v_email) THEN
      RAISE EXCEPTION 'Cet email est déjà utilisé par un autre compte';
    END IF;
  END IF;

  SELECT id INTO v_role_staff FROM roles WHERE code = 'staff_operationnel';

  INSERT INTO utilisateurs (email, prenom, nom, role_id, auth_mode, statut_validation, actif, valide_par_id, valide_le)
  VALUES (v_email, coalesce(nullif(trim(p_prenom), ''), 'Staff'), coalesce(trim(p_nom), ''), v_role_staff,
          'pin_seul', 'valide', true, v_moi, now())
  RETURNING id INTO v_id;

  INSERT INTO parcs_utilisateurs (utilisateur_id, parc_id)
  SELECT v_id, unnest(p_parc_ids);

  INSERT INTO invitations (token, email, prenom, nom, role_id, parcs_assignes, est_manager, auth_mode,
                           invite_par_id, utilisateur_cree_id, utilise_le, notes)
  VALUES (encode(extensions.gen_random_bytes(24), 'hex'), v_email, nullif(trim(p_prenom), ''), nullif(trim(p_nom), ''),
          v_role_staff, p_parc_ids, false, 'pin_seul', v_moi, v_id, now(), 'Staff PIN créé depuis Utilisateurs');

  RETURN v_id;
END;
$function$;

-- Code PIN : seulement pour un staff qu'on a le droit de gérer
CREATE OR REPLACE FUNCTION public.generer_pin_staff(p_utilisateur_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pin text;
  v_found boolean := false;
  v_i int;
  v_is_pin_seul boolean;
BEGIN
  SELECT (auth_mode = 'pin_seul') INTO v_is_pin_seul
  FROM utilisateurs WHERE id = p_utilisateur_id;
  IF v_is_pin_seul IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  ELSIF NOT v_is_pin_seul THEN
    RAISE EXCEPTION 'Cet utilisateur n''utilise pas de code PIN';
  END IF;

  IF NOT peut_gerer_utilisateur(p_utilisateur_id) THEN
    RAISE EXCEPTION 'Non autorisé à générer un code PIN pour ce compte';
  END IF;

  -- Génération sécurisée (pgcrypto) d'un PIN non trivial
  FOR v_i IN 1..100 LOOP
    v_pin := lpad((abs(('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::int) % 1000000)::text, 6, '0');
    IF NOT est_pin_trivial(v_pin) THEN
      v_found := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_found THEN
    RAISE EXCEPTION 'Impossible de générer un code PIN non trivial';
  END IF;

  UPDATE utilisateurs SET
    code_pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
    pin_must_change = true,
    pin_failed_attempts = 0,
    pin_locked_until = NULL,
    code_pin_genere_le = now()
  WHERE id = p_utilisateur_id;

  RETURN v_pin;
END;
$function$;