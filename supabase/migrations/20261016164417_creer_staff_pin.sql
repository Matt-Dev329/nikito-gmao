-- Création d'un compte staff (connexion par code PIN) par la direction, le
-- chef d'équipe, un directeur de parc ou un manager de parc. Les directeurs
-- et managers ne peuvent rattacher le staff qu'à leurs propres parcs.
-- Le code PIN est généré ensuite (generer_pin_staff / envoyer-pin-staff).
CREATE OR REPLACE FUNCTION public.creer_staff_pin(
  p_prenom text,
  p_nom text,
  p_email text,
  p_parc_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role role_utilisateur := (SELECT current_role_code());
  v_moi uuid := (SELECT current_utilisateur_id());
  v_role_staff uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
BEGIN
  IF v_role IS NULL OR v_moi IS NULL
     OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc') THEN
    RAISE EXCEPTION 'Non autorisé à créer un compte staff';
  END IF;
  IF p_parc_ids IS NULL OR cardinality(p_parc_ids) = 0 THEN
    RAISE EXCEPTION 'Choisis au moins un parc';
  END IF;
  IF v_role IN ('directeur_parc', 'manager_parc') AND NOT (p_parc_ids <@ current_parc_ids()) THEN
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

REVOKE ALL ON FUNCTION public.creer_staff_pin(text, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_staff_pin(text, text, text, uuid[]) TO authenticated;