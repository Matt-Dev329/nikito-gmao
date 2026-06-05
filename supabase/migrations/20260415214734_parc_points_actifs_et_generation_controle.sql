
-- 1) TABLE parc_points_actifs : override par parc
CREATE TABLE IF NOT EXISTS parc_points_actifs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id      UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  point_id     UUID NOT NULL REFERENCES bibliotheque_points(id) ON DELETE CASCADE,
  actif        BOOLEAN NOT NULL DEFAULT true,
  raison       TEXT,
  desactive_par_id UUID REFERENCES utilisateurs(id),
  desactive_le TIMESTAMPTZ,
  cree_le      TIMESTAMPTZ DEFAULT NOW(),
  modifie_le   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parc_id, point_id)
);

CREATE INDEX IF NOT EXISTS idx_ppa_parc ON parc_points_actifs(parc_id);
CREATE INDEX IF NOT EXISTS idx_ppa_point ON parc_points_actifs(point_id);

COMMENT ON TABLE parc_points_actifs IS
'Override par parc : ligne uniquement si on désactive un point. Absence = actif par défaut.';

-- 2) VUE points_applicables_par_parc
CREATE OR REPLACE VIEW v_points_applicables_par_parc AS
SELECT
  p.id              AS parc_id,
  p.code            AS parc_code,
  p.nom             AS parc_nom,
  bp.id             AS point_id,
  bp.libelle        AS point_libelle,
  bp.type_controle  AS type_controle,
  bp.assigne_a      AS assigne_a,
  bp.bloquant_si_ko AS bloquant,
  bp.photo_obligatoire AS photo_obligatoire,
  bp.ordre          AS ordre,
  ce.id             AS categorie_id,
  ce.nom            AS categorie_nom,
  COALESCE(ppa.actif, true) AS actif_pour_parc
FROM parcs p
JOIN parc_attractions pa     ON pa.parc_id = p.id
JOIN categories_equipement ce ON ce.id = pa.categorie_id
JOIN bibliotheque_points bp   ON bp.categorie_id = ce.id AND bp.actif = true
LEFT JOIN parc_points_actifs ppa
   ON ppa.parc_id = p.id AND ppa.point_id = bp.id;

-- 3) FONCTION generer_controle_quotidien
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
  VALUES (p_parc_id, p_date, 'quotidien', 'planifie', NOW())
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

-- 4) FONCTION generer_tous_controles_quotidiens
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
    SELECT COUNT(*) INTO v_nb FROM controle_items WHERE controle_id = v_ctrl_id;
    parc_code := r.code;
    controle_id := v_ctrl_id;
    nb_points := v_nb;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 5) RLS sur parc_points_actifs
ALTER TABLE parc_points_actifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppa_select_own_parcs" ON parc_points_actifs
  FOR SELECT TO authenticated
  USING (
    parc_id IN (
      SELECT parc_id FROM parcs_utilisateurs
      WHERE utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "ppa_modify_direction_chef" ON parc_points_actifs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid()
        AND r.code IN ('direction', 'chef_maintenance')
    )
  );
;
