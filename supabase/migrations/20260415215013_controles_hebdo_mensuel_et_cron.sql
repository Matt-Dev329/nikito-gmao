
-- ═══════════════════════════════════════════════════════════════════
-- 1) Fonction générique paramétrée par type
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generer_controle_par_type(
  p_parc_id  UUID,
  p_type     type_controle,
  p_date     DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_controle_id UUID;
  v_nb_points INT;
BEGIN
  -- Idempotence
  SELECT id INTO v_controle_id
  FROM controles
  WHERE parc_id = p_parc_id
    AND date_planifiee = p_date
    AND type = p_type;

  IF v_controle_id IS NOT NULL THEN
    RETURN v_controle_id;
  END IF;

  INSERT INTO controles (parc_id, date_planifiee, type, statut, cree_le)
  VALUES (p_parc_id, p_date, p_type, 'a_faire', NOW())
  RETURNING id INTO v_controle_id;

  INSERT INTO controle_items (controle_id, point_id, etat)
  SELECT v_controle_id, vpa.point_id, 'non_saisi'::etat_controle_item
  FROM v_points_applicables_par_parc vpa
  WHERE vpa.parc_id = p_parc_id
    AND vpa.type_controle = p_type
    AND vpa.actif_pour_parc = true;

  GET DIAGNOSTICS v_nb_points = ROW_COUNT;

  UPDATE controles
  SET meta = jsonb_build_object(
    'genere_auto', true,
    'genere_le', NOW(),
    'nb_points_initial', v_nb_points
  )
  WHERE id = v_controle_id;

  RETURN v_controle_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2) Wrappers par type (génération sur tous les parcs)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generer_tous_controles_hebdo(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(parc_code TEXT, controle_id UUID, nb_points BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD; v_ctrl_id UUID; v_nb BIGINT;
BEGIN
  FOR r IN SELECT id, code FROM parcs WHERE actif = true LOOP
    v_ctrl_id := generer_controle_par_type(r.id, 'hebdo'::type_controle, p_date);
    SELECT COUNT(*) INTO v_nb FROM controle_items ci WHERE ci.controle_id = v_ctrl_id;
    parc_code := r.code; controle_id := v_ctrl_id; nb_points := v_nb;
    RETURN NEXT;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION generer_tous_controles_mensuel(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(parc_code TEXT, controle_id UUID, nb_points BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD; v_ctrl_id UUID; v_nb BIGINT;
BEGIN
  FOR r IN SELECT id, code FROM parcs WHERE actif = true LOOP
    v_ctrl_id := generer_controle_par_type(r.id, 'mensuel'::type_controle, p_date);
    SELECT COUNT(*) INTO v_nb FROM controle_items ci WHERE ci.controle_id = v_ctrl_id;
    parc_code := r.code; controle_id := v_ctrl_id; nb_points := v_nb;
    RETURN NEXT;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3) On garde generer_tous_controles_quotidiens existant + on aligne
--    sur la fonction générique pour cohérence
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS generer_tous_controles_quotidiens(DATE);

CREATE OR REPLACE FUNCTION generer_tous_controles_quotidiens(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(parc_code TEXT, controle_id UUID, nb_points BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD; v_ctrl_id UUID; v_nb BIGINT;
BEGIN
  FOR r IN SELECT id, code FROM parcs WHERE actif = true LOOP
    v_ctrl_id := generer_controle_par_type(r.id, 'quotidien'::type_controle, p_date);
    SELECT COUNT(*) INTO v_nb FROM controle_items ci WHERE ci.controle_id = v_ctrl_id;
    parc_code := r.code; controle_id := v_ctrl_id; nb_points := v_nb;
    RETURN NEXT;
  END LOOP;
END $$;
;
