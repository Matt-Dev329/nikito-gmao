-- Helpers
CREATE OR REPLACE FUNCTION current_utilisateur_id() RETURNS UUID AS $$
  SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_role_code() RETURNS role_utilisateur AS $$
  SELECT r.code FROM roles r
  JOIN utilisateurs u ON u.role_id = r.id
  WHERE u.auth_user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_parc_ids() RETURNS UUID[] AS $$
  SELECT COALESCE(ARRAY_AGG(parc_id), ARRAY[]::UUID[])
  FROM parcs_utilisateurs WHERE utilisateur_id = current_utilisateur_id();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

ALTER TABLE parcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controles ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaintes_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiches_5_pourquoi ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives_pdf ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "direction_total_access" ON parcs FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance'));
CREATE POLICY "manager_son_parc" ON parcs FOR SELECT
  USING (current_role_code() = 'manager_parc' AND id = ANY(current_parc_ids()));
CREATE POLICY "tech_lecture_parcs" ON parcs FOR SELECT
  USING (current_role_code() = 'technicien');
CREATE POLICY "staff_son_parc" ON parcs FOR SELECT
  USING (current_role_code() = 'staff_operationnel' AND id = ANY(current_parc_ids()));

CREATE POLICY "equip_direction_total" ON equipements FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance','technicien'));
CREATE POLICY "equip_manager_parc" ON equipements FOR ALL
  USING (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()));
CREATE POLICY "equip_staff_parc" ON equipements FOR SELECT
  USING (current_role_code() = 'staff_operationnel' AND parc_id = ANY(current_parc_ids()));

CREATE POLICY "inc_direction_total" ON incidents FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance','technicien'));
CREATE POLICY "inc_manager_parc" ON incidents FOR ALL
  USING (current_role_code() = 'manager_parc'
    AND equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY(current_parc_ids())));
CREATE POLICY "inc_staff_parc_creation" ON incidents FOR INSERT
  WITH CHECK (current_role_code() = 'staff_operationnel'
    AND equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY(current_parc_ids())));
CREATE POLICY "inc_staff_parc_lecture" ON incidents FOR SELECT
  USING (current_role_code() = 'staff_operationnel'
    AND equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY(current_parc_ids())));

CREATE POLICY "ctrl_direction_total" ON controles FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance','technicien'));
CREATE POLICY "ctrl_manager_parc" ON controles FOR ALL
  USING (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()));
CREATE POLICY "ctrl_staff_parc" ON controles FOR ALL
  USING (current_role_code() = 'staff_operationnel' AND parc_id = ANY(current_parc_ids()));

CREATE POLICY "gps_direction" ON gps_positions FOR SELECT
  USING (current_role_code() IN ('direction','chef_maintenance'));
CREATE POLICY "gps_self" ON gps_positions FOR SELECT
  USING (technicien_id = current_utilisateur_id());
CREATE POLICY "gps_insert" ON gps_positions FOR INSERT
  WITH CHECK (technicien_id = current_utilisateur_id());

-- Politique utilisateurs (manquante dans le SQL d'origine, ajoutée)
CREATE POLICY "user_self_read" ON utilisateurs FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "user_direction_all" ON utilisateurs FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance'));;
