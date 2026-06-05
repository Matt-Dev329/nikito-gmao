
-- ═══════════════════════════════════════════════════════════════════
-- POLITIQUES POUR LES 6 TABLES AVEC RLS MAIS SANS POLITIQUE
-- ═══════════════════════════════════════════════════════════════════

-- archives_pdf
CREATE POLICY "archives_lecture_authentifies" ON archives_pdf FOR SELECT TO authenticated USING (true);
CREATE POLICY "archives_creation_systeme" ON archives_pdf FOR INSERT TO authenticated 
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));

-- controle_items
CREATE POLICY "items_lecture_authentifies" ON controle_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_ecriture_authentifies" ON controle_items FOR INSERT TO authenticated 
  WITH CHECK (true);
CREATE POLICY "items_modification_authentifies" ON controle_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- fiches_5_pourquoi
CREATE POLICY "5p_lecture_authentifies" ON fiches_5_pourquoi FOR SELECT TO authenticated USING (true);
CREATE POLICY "5p_creation_techniciens" ON fiches_5_pourquoi FOR INSERT TO authenticated
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));
CREATE POLICY "5p_modification_techniciens" ON fiches_5_pourquoi FOR UPDATE TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));

-- interventions
CREATE POLICY "interv_lecture_authentifies" ON interventions FOR SELECT TO authenticated USING (true);
CREATE POLICY "interv_ecriture_techniciens" ON interventions FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));

-- plaintes_clients
CREATE POLICY "plaintes_lecture_authentifies" ON plaintes_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "plaintes_creation_authentifies" ON plaintes_clients FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "plaintes_modif_admin" ON plaintes_clients FOR UPDATE TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc'));

-- zones
CREATE POLICY "zones_lecture_authentifies" ON zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "zones_ecriture_admin" ON zones FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));
;
