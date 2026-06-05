/*
  # Mise a jour RPC verifier_pin_staff avec verrouillage

  1. Modifications
    - Ajout verification du verrouillage (pin_locked_until) avant la comparaison bcrypt
    - Increment pin_failed_attempts a chaque echec (max 5 avant verrouillage 5 min)
    - Reset pin_failed_attempts et pin_locked_until au succes
    - Retourne pin_must_change pour permettre la redirection 1er login
    - Retourne is_locked et lock_remaining_seconds pour affichage cote client

  2. Notes
    - Le verrouillage est gere atomiquement cote serveur (pas de race condition)
    - Apres 5 echecs consecutifs, le compte est verrouille 5 minutes
    - Le compteur se reinitialise a 0 apres un login reussi
*/

DROP FUNCTION IF EXISTS verifier_pin_staff(text, text);


CREATE FUNCTION verifier_pin_staff(
  p_parc_code text,
  p_pin text
)
RETURNS TABLE (
  utilisateur_id uuid,
  prenom text,
  nom text,
  trigramme text,
  role_code role_utilisateur,
  pin_must_change boolean,
  is_locked boolean,
  lock_remaining_seconds int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_id UUID;

  v_user RECORD;

BEGIN
  SELECT id INTO v_parc_id FROM parcs WHERE code = p_parc_code AND actif = TRUE;

  IF v_parc_id IS NULL THEN RETURN;
 END IF;


  FOR v_user IN
    SELECT u.id, u.prenom, u.nom, u.trigramme, r.code AS role_code,
           u.code_pin_hash, u.pin_must_change,
           u.pin_failed_attempts, u.pin_locked_until
    FROM utilisateurs u
    JOIN roles r ON r.id = u.role_id
    JOIN parcs_utilisateurs pu ON pu.utilisateur_id = u.id
    WHERE pu.parc_id = v_parc_id
      AND u.auth_mode = 'pin_seul'
      AND u.statut_validation = 'valide'
      AND u.actif = TRUE
  LOOP
    IF v_user.pin_locked_until IS NOT NULL AND v_user.pin_locked_until > now() THEN
      IF v_user.code_pin_hash = crypt(p_pin, v_user.code_pin_hash) THEN
        RETURN QUERY SELECT
          v_user.id, v_user.prenom, v_user.nom, v_user.trigramme,
          v_user.role_code, v_user.pin_must_change,
          TRUE::boolean,
          GREATEST(0, EXTRACT(EPOCH FROM (v_user.pin_locked_until - now()))::int);

        RETURN;

      END IF;

      CONTINUE;

    END IF;


    IF v_user.code_pin_hash = crypt(p_pin, v_user.code_pin_hash) THEN
      UPDATE utilisateurs SET
        pin_failed_attempts = 0,
        pin_locked_until = NULL
      WHERE id = v_user.id;


      RETURN QUERY SELECT
        v_user.id, v_user.prenom, v_user.nom, v_user.trigramme,
        v_user.role_code, v_user.pin_must_change,
        FALSE::boolean, 0;

      RETURN;

    END IF;

  END LOOP;


  UPDATE utilisateurs u SET
    pin_failed_attempts = u.pin_failed_attempts + 1,
    pin_locked_until = CASE
      WHEN u.pin_failed_attempts + 1 >= 5 THEN now() + interval '5 minutes'
      ELSE u.pin_locked_until
    END
  FROM parcs_utilisateurs pu
  WHERE pu.utilisateur_id = u.id
    AND pu.parc_id = v_parc_id
    AND u.auth_mode = 'pin_seul'
    AND u.statut_validation = 'valide'
    AND u.actif = TRUE
    AND (u.pin_locked_until IS NULL OR u.pin_locked_until <= now());


  RETURN;

END;

$$;

;
