/*
  # Replace Conformite ERP RLS policies

  Replaces the initial per-operation policies with the updated spec:
  - direction/admin_it have global read access (no parc restriction)
  - FOR ALL policies for write access (simpler, fewer policies)
  - prescriptions: separate INSERT/UPDATE/DELETE with responsable_id pattern
  - notifications: SELECT/UPDATE self only, INSERT via service_role only

  ## Changes
  - Drops all 24 existing policies on conformite tables
  - Creates new policies matching the updated spec
  - parcs_phases: read (parc members + direction), write FOR ALL (direction/admin_it/chef_maintenance)
  - commissions_securite: same pattern
  - prescriptions_securite: read (parc members + direction), insert (encadrement + manager_parc), update (encadrement + manager_parc + responsable), delete (direction/admin_it only)
  - documents_chantier: read (parc members + direction), write FOR ALL (direction/admin_it/chef_maintenance/manager_parc)
  - acteurs_chantier: read (parc members + direction), write FOR ALL (direction/admin_it/chef_maintenance)
  - notifications_conformite: read/update self only, insert via service_role
*/

-- ============================================================
-- Drop all existing policies
-- ============================================================

-- parcs_phases
DROP POLICY IF EXISTS "Utilisateurs voient phases de leurs parcs" ON parcs_phases;
DROP POLICY IF EXISTS "Roles encadrement inserent phases" ON parcs_phases;
DROP POLICY IF EXISTS "Roles encadrement modifient phases" ON parcs_phases;
DROP POLICY IF EXISTS "Roles encadrement suppriment phases" ON parcs_phases;

-- commissions_securite
DROP POLICY IF EXISTS "Utilisateurs voient commissions de leurs parcs" ON commissions_securite;
DROP POLICY IF EXISTS "Roles encadrement inserent commissions" ON commissions_securite;
DROP POLICY IF EXISTS "Roles encadrement modifient commissions" ON commissions_securite;
DROP POLICY IF EXISTS "Direction supprime commissions" ON commissions_securite;

-- prescriptions_securite
DROP POLICY IF EXISTS "Utilisateurs voient prescriptions de leurs parcs" ON prescriptions_securite;
DROP POLICY IF EXISTS "Roles encadrement inserent prescriptions" ON prescriptions_securite;
DROP POLICY IF EXISTS "Roles encadrement modifient prescriptions" ON prescriptions_securite;
DROP POLICY IF EXISTS "Direction supprime prescriptions" ON prescriptions_securite;

-- documents_chantier
DROP POLICY IF EXISTS "Utilisateurs voient documents de leurs parcs" ON documents_chantier;
DROP POLICY IF EXISTS "Roles encadrement inserent documents" ON documents_chantier;
DROP POLICY IF EXISTS "Roles encadrement modifient documents" ON documents_chantier;
DROP POLICY IF EXISTS "Direction supprime documents" ON documents_chantier;

-- acteurs_chantier
DROP POLICY IF EXISTS "Utilisateurs voient acteurs de leurs parcs" ON acteurs_chantier;
DROP POLICY IF EXISTS "Roles encadrement inserent acteurs" ON acteurs_chantier;
DROP POLICY IF EXISTS "Roles encadrement modifient acteurs" ON acteurs_chantier;
DROP POLICY IF EXISTS "Direction supprime acteurs" ON acteurs_chantier;

-- notifications_conformite
DROP POLICY IF EXISTS "Utilisateurs voient leurs notifications conformite" ON notifications_conformite;
DROP POLICY IF EXISTS "Systeme insere notifications conformite" ON notifications_conformite;
DROP POLICY IF EXISTS "Utilisateurs marquent lu leurs notifications" ON notifications_conformite;
DROP POLICY IF EXISTS "Utilisateurs suppriment leurs notifications conformite" ON notifications_conformite;

-- ============================================================
-- parcs_phases
-- ============================================================

CREATE POLICY "phases_read" ON parcs_phases FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

CREATE POLICY "phases_write" ON parcs_phases FOR ALL
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

-- ============================================================
-- commissions_securite
-- ============================================================

CREATE POLICY "commissions_read" ON commissions_securite FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

CREATE POLICY "commissions_write" ON commissions_securite FOR ALL
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

-- ============================================================
-- prescriptions_securite
-- ============================================================

CREATE POLICY "prescriptions_read" ON prescriptions_securite FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

CREATE POLICY "prescriptions_insert" ON prescriptions_securite FOR INSERT
  TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'admin_it', 'chef_maintenance')
    OR (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()))
  );

CREATE POLICY "prescriptions_update" ON prescriptions_securite FOR UPDATE
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it', 'chef_maintenance')
    OR (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()))
    OR responsable_id = current_utilisateur_id()
  )
  WITH CHECK (
    current_role_code() IN ('direction', 'admin_it', 'chef_maintenance')
    OR (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()))
    OR responsable_id = current_utilisateur_id()
  );

CREATE POLICY "prescriptions_delete" ON prescriptions_securite FOR DELETE
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it'));

-- ============================================================
-- documents_chantier
-- ============================================================

CREATE POLICY "documents_read" ON documents_chantier FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

CREATE POLICY "documents_write" ON documents_chantier FOR ALL
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance', 'manager_parc'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance', 'manager_parc'));

-- ============================================================
-- acteurs_chantier
-- ============================================================

CREATE POLICY "acteurs_read" ON acteurs_chantier FOR SELECT
  TO authenticated
  USING (
    current_role_code() IN ('direction', 'admin_it')
    OR parc_id = ANY(current_parc_ids())
  );

CREATE POLICY "acteurs_write" ON acteurs_chantier FOR ALL
  TO authenticated
  USING (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'))
  WITH CHECK (current_role_code() IN ('direction', 'admin_it', 'chef_maintenance'));

-- ============================================================
-- notifications_conformite
-- ============================================================

CREATE POLICY "notif_conf_read_self" ON notifications_conformite FOR SELECT
  TO authenticated
  USING (destinataire_id = current_utilisateur_id());

CREATE POLICY "notif_conf_update_self" ON notifications_conformite FOR UPDATE
  TO authenticated
  USING (destinataire_id = current_utilisateur_id())
  WITH CHECK (destinataire_id = current_utilisateur_id());
