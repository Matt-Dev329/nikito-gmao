
DROP FUNCTION IF EXISTS generer_tous_controles_quotidiens(DATE);

CREATE OR REPLACE FUNCTION generer_tous_controles_quotidiens(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(parc_code TEXT, controle_id UUID, nb_points BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_ctrl_id UUID;
  v_nb BIGINT;
BEGIN
  FOR r IN SELECT id, code FROM parcs WHERE actif = true LOOP
    v_ctrl_id := generer_controle_quotidien(r.id, p_date);
    SELECT COUNT(*) INTO v_nb FROM controle_items ci WHERE ci.controle_id = v_ctrl_id;
    parc_code := r.code;
    controle_id := v_ctrl_id;
    nb_points := v_nb;
    RETURN NEXT;
  END LOOP;
END;
$$;
;
