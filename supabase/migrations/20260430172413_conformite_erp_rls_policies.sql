/*
  # Module Conformite ERP - Policies RLS

  Acces base sur :
  - current_parc_ids() : l'utilisateur ne voit que les donnees de ses parcs
  - current_role_code() : seuls direction, admin_it, manager_parc, chef_maintenance peuvent modifier
  - Notifications : chaque utilisateur ne voit que les siennes

  Roles avec acces en ecriture sur le module conformite :
  - direction, admin_it, manager_parc, chef_maintenance

  Roles avec acces en lecture seule :
  - technicien, staff_operationnel (sur leurs parcs uniquement)
*/

-- ============================================================
-- parcs_phases
-- ============================================================

CREATE POLICY "Utilisateurs voient phases de leurs parcs"
  ON parcs_phases FOR SELECT
  TO authenticated
  USING (parc_id = ANY(current_parc_ids()));

CREATE POLICY "Roles encadrement inserent phases"
  ON parcs_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement modifient phases"
  ON parcs_phases FOR UPDATE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  )
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement suppriment phases"
  ON parcs_phases FOR DELETE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it')
  );

-- ============================================================
-- commissions_securite
-- ============================================================

CREATE POLICY "Utilisateurs voient commissions de leurs parcs"
  ON commissions_securite FOR SELECT
  TO authenticated
  USING (parc_id = ANY(current_parc_ids()));

CREATE POLICY "Roles encadrement inserent commissions"
  ON commissions_securite FOR INSERT
  TO authenticated
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement modifient commissions"
  ON commissions_securite FOR UPDATE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  )
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Direction supprime commissions"
  ON commissions_securite FOR DELETE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it')
  );

-- ============================================================
-- prescriptions_securite
-- ============================================================

CREATE POLICY "Utilisateurs voient prescriptions de leurs parcs"
  ON prescriptions_securite FOR SELECT
  TO authenticated
  USING (parc_id = ANY(current_parc_ids()));

CREATE POLICY "Roles encadrement inserent prescriptions"
  ON prescriptions_securite FOR INSERT
  TO authenticated
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement modifient prescriptions"
  ON prescriptions_securite FOR UPDATE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  )
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Direction supprime prescriptions"
  ON prescriptions_securite FOR DELETE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it')
  );

-- ============================================================
-- documents_chantier
-- ============================================================

CREATE POLICY "Utilisateurs voient documents de leurs parcs"
  ON documents_chantier FOR SELECT
  TO authenticated
  USING (parc_id = ANY(current_parc_ids()));

CREATE POLICY "Roles encadrement inserent documents"
  ON documents_chantier FOR INSERT
  TO authenticated
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement modifient documents"
  ON documents_chantier FOR UPDATE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  )
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Direction supprime documents"
  ON documents_chantier FOR DELETE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it')
  );

-- ============================================================
-- acteurs_chantier
-- ============================================================

CREATE POLICY "Utilisateurs voient acteurs de leurs parcs"
  ON acteurs_chantier FOR SELECT
  TO authenticated
  USING (parc_id = ANY(current_parc_ids()));

CREATE POLICY "Roles encadrement inserent acteurs"
  ON acteurs_chantier FOR INSERT
  TO authenticated
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Roles encadrement modifient acteurs"
  ON acteurs_chantier FOR UPDATE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  )
  WITH CHECK (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Direction supprime acteurs"
  ON acteurs_chantier FOR DELETE
  TO authenticated
  USING (
    parc_id = ANY(current_parc_ids())
    AND current_role_code() IN ('direction', 'admin_it')
  );

-- ============================================================
-- notifications_conformite
-- ============================================================

CREATE POLICY "Utilisateurs voient leurs notifications conformite"
  ON notifications_conformite FOR SELECT
  TO authenticated
  USING (destinataire_id = current_utilisateur_id());

CREATE POLICY "Systeme insere notifications conformite"
  ON notifications_conformite FOR INSERT
  TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'admin_it', 'manager_parc', 'chef_maintenance')
  );

CREATE POLICY "Utilisateurs marquent lu leurs notifications"
  ON notifications_conformite FOR UPDATE
  TO authenticated
  USING (destinataire_id = current_utilisateur_id())
  WITH CHECK (destinataire_id = current_utilisateur_id());

CREATE POLICY "Utilisateurs suppriment leurs notifications conformite"
  ON notifications_conformite FOR DELETE
  TO authenticated
  USING (destinataire_id = current_utilisateur_id());
