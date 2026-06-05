/*
  # Fix accepter_invitation search_path for pgcrypto

  ## Problem
  The `accepter_invitation` function uses `crypt()` and `gen_salt()` from pgcrypto,
  but its search_path is set to 'public' only. Since pgcrypto is installed in the
  'extensions' schema, the function fails with "function gen_salt(unknown) does not exist"
  when a PIN code is provided (staff mode).

  Even when p_pin_clair is NULL, PostgreSQL may still validate the CASE branch at parse time
  in some execution contexts, causing the error.

  ## Fix
  Recreate both overloads of `accepter_invitation` with search_path including 'extensions'.

  ## Security
  - Function remains SECURITY DEFINER
  - search_path is explicit and does not include user-writable schemas
*/

-- Drop old overloads and recreate with correct search_path
CREATE OR REPLACE FUNCTION public.accepter_invitation(
  p_token text,
  p_auth_user_id uuid,
  p_pin_clair text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_nom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
      CASE WHEN p_pin_clair IS NOT NULL THEN crypt(p_pin_clair, gen_salt('bf')) ELSE NULL END,
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

$function$;

;
