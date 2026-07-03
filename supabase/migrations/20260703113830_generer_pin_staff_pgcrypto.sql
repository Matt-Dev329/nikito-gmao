-- Génération du code PIN staff côté Postgres (pgcrypto), remplace la fonction
-- edge `hash-pin` (bcryptjs) qui renvoyait 500 dans le runtime Deno.
-- Le hash est identique au reste du système : extensions.crypt(pin, gen_salt('bf')),
-- vérifié par verifier_pin_staff (format $2a$).

-- Détection d'un PIN trivial (répétition, séquence, motif ABABAB / ABCABC, blocklist)
CREATE OR REPLACE FUNCTION public.est_pin_trivial(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  d int[];
  i int;
  asc_seq boolean := true;
  desc_seq boolean := true;
  all_same boolean := true;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN true;
  END IF;
  d := ARRAY[
    ascii(substr(p_pin,1,1)) - 48,
    ascii(substr(p_pin,2,1)) - 48,
    ascii(substr(p_pin,3,1)) - 48,
    ascii(substr(p_pin,4,1)) - 48,
    ascii(substr(p_pin,5,1)) - 48,
    ascii(substr(p_pin,6,1)) - 48
  ];
  FOR i IN 2..6 LOOP
    IF d[i] <> d[i-1] + 1 THEN asc_seq := false; END IF;
    IF d[i] <> d[i-1] - 1 THEN desc_seq := false; END IF;
    IF d[i] <> d[1] THEN all_same := false; END IF;
  END LOOP;
  IF all_same OR asc_seq OR desc_seq THEN RETURN true; END IF;
  -- motif ABABAB
  IF substr(p_pin,1,2) = substr(p_pin,3,2) AND substr(p_pin,3,2) = substr(p_pin,5,2) THEN
    RETURN true;
  END IF;
  -- motif ABCABC
  IF substr(p_pin,1,3) = substr(p_pin,4,3) THEN RETURN true; END IF;
  -- blocklist courte
  IF p_pin IN ('123456','654321','012345','543210','112233','001122') THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- Génère un PIN à 6 chiffres non trivial, le hash et l'enregistre. Retourne le PIN en clair.
CREATE OR REPLACE FUNCTION public.generer_pin_staff(p_utilisateur_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role role_utilisateur;
  v_pin text;
  v_found boolean := false;
  v_i int;
  v_is_pin_seul boolean;
BEGIN
  -- Autorisation : mêmes rôles que la création de staff (cf policy parcs_utilisateurs)
  v_role := (SELECT current_role_code());
  IF v_role IS NULL
     OR v_role NOT IN ('direction','chef_maintenance','directeur_parc','manager_parc') THEN
    RAISE EXCEPTION 'Non autorisé à générer un code PIN';
  END IF;

  SELECT (auth_mode = 'pin_seul') INTO v_is_pin_seul
  FROM utilisateurs WHERE id = p_utilisateur_id;
  IF v_is_pin_seul IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  ELSIF NOT v_is_pin_seul THEN
    RAISE EXCEPTION 'Cet utilisateur n''utilise pas de code PIN';
  END IF;

  -- Un manager de parc ne peut agir que sur un staff rattaché à l'un de ses parcs
  IF v_role = 'manager_parc' THEN
    IF NOT EXISTS (
      SELECT 1 FROM parcs_utilisateurs pu
      WHERE pu.utilisateur_id = p_utilisateur_id
        AND pu.parc_id = ANY (current_parc_ids())
    ) THEN
      RAISE EXCEPTION 'Non autorisé sur le parc de cet utilisateur';
    END IF;
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
$$;

REVOKE ALL ON FUNCTION public.generer_pin_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generer_pin_staff(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.generer_pin_staff(uuid) TO authenticated;
