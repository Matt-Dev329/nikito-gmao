
CREATE OR REPLACE FUNCTION generer_controle_quotidien(
  p_parc_id  UUID,
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
  SELECT id INTO v_controle_id
  FROM controles
  WHERE parc_id = p_parc_id
    AND date_planifiee = p_date
    AND type = 'quotidien';

  IF v_controle_id IS NOT NULL THEN
    RETURN v_controle_id;
  END IF;

  INSERT INTO controles (parc_id, date_planifiee, type, statut, cree_le)
  VALUES (p_parc_id, p_date, 'quotidien', 'a_faire', NOW())
  RETURNING id INTO v_controle_id;

  INSERT INTO controle_items (controle_id, point_id, etat, saisi_le)
  SELECT v_controle_id, vpa.point_id, NULL, NULL
  FROM v_points_applicables_par_parc vpa
  WHERE vpa.parc_id = p_parc_id
    AND vpa.type_controle = 'quotidien'
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
;
