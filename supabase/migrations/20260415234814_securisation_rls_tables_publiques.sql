
-- ═══════════════════════════════════════════════════════════════════
-- ACTIVATION RLS + POLITIQUES SUR LES 13 TABLES OUVERTES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Référentiels publics (lecture pour tous, écriture direction/chef seulement) ───

-- bibliotheque_points
ALTER TABLE bibliotheque_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biblio_lecture_tous" ON bibliotheque_points FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "biblio_ecriture_admin" ON bibliotheque_points FOR ALL TO authenticated 
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- categories_equipement
ALTER TABLE categories_equipement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_lecture_tous" ON categories_equipement FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_ecriture_admin" ON categories_equipement FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- niveaux_priorite
ALTER TABLE niveaux_priorite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "priorite_lecture_tous" ON niveaux_priorite FOR SELECT TO authenticated USING (true);
CREATE POLICY "priorite_ecriture_direction" ON niveaux_priorite FOR ALL TO authenticated
  USING (current_role_code() = 'direction')
  WITH CHECK (current_role_code() = 'direction');

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_lecture_tous" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_ecriture_direction" ON roles FOR ALL TO authenticated
  USING (current_role_code() = 'direction')
  WITH CHECK (current_role_code() = 'direction');

-- standards_evolutifs
ALTER TABLE standards_evolutifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standards_lecture_tous" ON standards_evolutifs FOR SELECT TO authenticated USING (true);
CREATE POLICY "standards_ecriture_admin" ON standards_evolutifs FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- ─── Configuration métier (lecture authentifiés, écriture admin) ───

-- parc_attractions
ALTER TABLE parc_attractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attractions_lecture_authentifies" ON parc_attractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "attractions_ecriture_admin" ON parc_attractions FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- fixtures_lumiere
ALTER TABLE fixtures_lumiere ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixtures_lecture_authentifies" ON fixtures_lumiere FOR SELECT TO authenticated USING (true);
CREATE POLICY "fixtures_ecriture_admin" ON fixtures_lumiere FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- ─── Données opérationnelles (sensibles) ───

-- fournisseurs (contient contacts, téléphones)
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fournisseurs_lecture_authentifies" ON fournisseurs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fournisseurs_ecriture_admin" ON fournisseurs FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- pieces_detachees
ALTER TABLE pieces_detachees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pieces_lecture_authentifies" ON pieces_detachees FOR SELECT TO authenticated USING (true);
CREATE POLICY "pieces_ecriture_techniciens" ON pieces_detachees FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));

-- pieces_utilisees
ALTER TABLE pieces_utilisees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pieces_util_lecture_authentifies" ON pieces_utilisees FOR SELECT TO authenticated USING (true);
CREATE POLICY "pieces_util_ecriture_techniciens" ON pieces_utilisees FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance', 'technicien'));

-- ─── Maintenance préventive et certifications ───

-- maintenances_preventives
ALTER TABLE maintenances_preventives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preventif_lecture_authentifies" ON maintenances_preventives FOR SELECT TO authenticated USING (true);
CREATE POLICY "preventif_ecriture_admin" ON maintenances_preventives FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- certifications
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifs_lecture_authentifies" ON certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "certifs_ecriture_admin" ON certifications FOR ALL TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'chef_maintenance'));

-- ─── RH (sensible) ───

-- parcs_utilisateurs (lien user ↔ parc)
ALTER TABLE parcs_utilisateurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pu_lecture_admin" ON parcs_utilisateurs FOR SELECT TO authenticated 
  USING (
    current_role_code() IN ('direction', 'chef_maintenance')
    OR utilisateur_id = current_utilisateur_id()
  );
CREATE POLICY "pu_ecriture_direction" ON parcs_utilisateurs FOR ALL TO authenticated
  USING (current_role_code() = 'direction')
  WITH CHECK (current_role_code() = 'direction');
;
