/*
  # Fix accepter_invitation to be idempotent

  1. Problem
    - When a user signs up via auth but the RPC call fails or is interrupted,
      the user ends up in auth.users but NOT in utilisateurs.
    - On retry, signUp returns "already registered", the code falls back to
      signInWithPassword, but the RPC fails because the invitation was already
      partially processed or the INSERT into utilisateurs hits a duplicate.

  2. Changes
    - Replace the accepter_invitation function with an idempotent version
    - If utilisateur already exists for this auth_user_id, skip INSERT
    - If parcs_utilisateurs already has entries, skip INSERT
    - Always mark the invitation as used at the end

  3. Security
    - Remains SECURITY DEFINER
    - Still callable by anon and authenticated
    - search_path set to public for safety
*/

CREATE OR REPLACE FUNCTION public.accepter_invitation(
  p_token text,
  p_auth_user_id uuid,
  p_pin_clair text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invit invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_invit FROM invitations
  WHERE token = p_token AND expire_le > NOW();

  IF v_invit.id IS NULL THEN
    RAISE EXCEPTION 'Invitation invalide ou expirée';
  END IF;

  IF v_invit.utilise_le IS NOT NULL AND v_invit.utilisateur_cree_id IS NOT NULL THEN
    RETURN v_invit.utilisateur_cree_id;
  END IF;

  SELECT id INTO v_user_id FROM utilisateurs
  WHERE auth_user_id = p_auth_user_id;

  IF v_user_id IS NULL AND p_auth_user_id IS NOT NULL THEN
    SELECT id INTO v_user_id FROM utilisateurs
    WHERE email = v_invit.email;
  END IF;

  IF v_user_id IS NULL THEN
    INSERT INTO utilisateurs (
      auth_user_id, email, nom, prenom,
      role_id, auth_mode, statut_validation,
      code_pin_hash, code_pin_genere_le, valide_par_id, valide_le
    ) VALUES (
      p_auth_user_id,
      v_invit.email,
      v_invit.nom,
      v_invit.prenom,
      v_invit.role_id,
      v_invit.auth_mode,
      'valide',
      CASE WHEN p_pin_clair IS NOT NULL THEN crypt(p_pin_clair, gen_salt('bf')) ELSE NULL END,
      CASE WHEN p_pin_clair IS NOT NULL THEN NOW() ELSE NULL END,
      v_invit.invite_par_id,
      NOW()
    )
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE utilisateurs SET
      auth_user_id = COALESCE(utilisateurs.auth_user_id, p_auth_user_id),
      role_id = v_invit.role_id,
      statut_validation = 'valide',
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
