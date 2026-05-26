/*
  # Fix accepter_invitation: qualify pgcrypto functions with extensions schema

  1. Problem
    - Function has SET search_path = public, so crypt() and gen_salt() are not found
    - pgcrypto extension is in the 'extensions' schema
    - Caused "function gen_salt(unknown) does not exist" error in the UPDATE branch

  2. Fix
    - Qualify all crypt() and gen_salt() calls with extensions. prefix
*/

CREATE OR REPLACE FUNCTION public.accepter_invitation(
  p_token text,
  p_auth_user_id uuid DEFAULT NULL,
  p_pin_clair text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_nom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invit invitations%ROWTYPE;
  v_user_id UUID;
  v_prenom text;
  v_nom text;
BEGIN
  SELECT * INTO v_invit FROM invitations
  WHERE token = p_token AND expire_le > NOW();

  IF v_invit.id IS NULL THEN
    RAISE EXCEPTION 'Invitation invalide ou expirée';
  END IF;

  IF v_invit.utilise_le IS NOT NULL AND v_invit.utilisateur_cree_id IS NOT NULL THEN
    RETURN v_invit.utilisateur_cree_id;
  END IF;

  v_prenom := COALESCE(p_prenom, v_invit.prenom, '');
  v_nom := COALESCE(p_nom, v_invit.nom, '');

  -- Try to find existing user by auth_user_id first
  IF p_auth_user_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM utilisateurs
    WHERE auth_user_id = p_auth_user_id;
  END IF;

  -- Always try to find by email if not found yet
  IF v_user_id IS NULL AND v_invit.email IS NOT NULL THEN
    SELECT id INTO v_user_id FROM utilisateurs
    WHERE email = v_invit.email;
  END IF;

  IF v_user_id IS NULL THEN
    INSERT INTO utilisateurs (
      auth_user_id, email, nom, prenom,
      role_id, auth_mode, statut_validation,
      telephone, photo_url,
      code_pin_hash, code_pin_genere_le, valide_par_id, valide_le
    ) VALUES (
      p_auth_user_id,
      v_invit.email,
      v_nom,
      v_prenom,
      v_invit.role_id,
      v_invit.auth_mode,
      'valide',
      p_telephone,
      p_photo_url,
      CASE WHEN p_pin_clair IS NOT NULL THEN extensions.crypt(p_pin_clair, extensions.gen_salt('bf')) ELSE NULL END,
      CASE WHEN p_pin_clair IS NOT NULL THEN NOW() ELSE NULL END,
      v_invit.invite_par_id,
      NOW()
    )
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE utilisateurs SET
      auth_user_id = COALESCE(utilisateurs.auth_user_id, p_auth_user_id),
      prenom = COALESCE(NULLIF(v_prenom, ''), utilisateurs.prenom),
      nom = COALESCE(NULLIF(v_nom, ''), utilisateurs.nom),
      telephone = COALESCE(p_telephone, utilisateurs.telephone),
      photo_url = COALESCE(p_photo_url, utilisateurs.photo_url),
      role_id = v_invit.role_id,
      auth_mode = v_invit.auth_mode,
      statut_validation = 'valide',
      actif = true,
      code_pin_hash = CASE WHEN p_pin_clair IS NOT NULL THEN extensions.crypt(p_pin_clair, extensions.gen_salt('bf')) ELSE NULL END,
      code_pin_genere_le = CASE WHEN p_pin_clair IS NOT NULL THEN NOW() ELSE utilisateurs.code_pin_genere_le END,
      valide_par_id = COALESCE(utilisateurs.valide_par_id, v_invit.invite_par_id),
      valide_le = COALESCE(utilisateurs.valide_le, NOW())
    WHERE id = v_user_id;
  END IF;

  IF array_length(v_invit.parcs_assignes, 1) > 0 THEN
    INSERT INTO parcs_utilisateurs (utilisateur_id, parc_id, est_manager)
    SELECT v_user_id, unnest(v_invit.parcs_assignes), v_invit.est_manager
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE invitations SET utilise_le = NOW(), utilisateur_cree_id = v_user_id
  WHERE id = v_invit.id;

  RETURN v_user_id;
END;
$$;
