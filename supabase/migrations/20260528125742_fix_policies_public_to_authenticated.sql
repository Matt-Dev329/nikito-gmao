/*
  # Fix RLS policies: restrict role-based policies to authenticated only

  1. Problem
    - Multiple policies use `roles = {public}` (meaning they apply to ALL roles including anon)
    - These policies call `current_role_code()` and `current_parc_ids()` which are
      only granted to authenticated
    - When anon queries these tables, PostgreSQL evaluates ALL applicable policy
      expressions, including ones calling these functions, causing permission errors
    - This broke the staff login page (which queries parcs as anon)

  2. Fix
    - Drop and recreate affected policies with `TO authenticated` instead of default (public)
    - Tables affected: parcs, equipements, incidents, invitations, notes_chantier,
      functions_security_policy, gps_positions

  3. Security note
    - These policies check role_code for direction/manager/tech/staff
    - They are meaningless for anon (anon has no role_code)
    - Restricting to authenticated is strictly more secure
*/

-- ============================================================
-- PARCS
-- ============================================================

DROP POLICY IF EXISTS "direction_total_access" ON parcs;
CREATE POLICY "direction_total_access" ON parcs
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]));

DROP POLICY IF EXISTS "manager_son_parc" ON parcs;
CREATE POLICY "manager_son_parc" ON parcs
  FOR SELECT TO authenticated
  USING ((current_role_code() = 'manager_parc'::role_utilisateur) AND (id = ANY (current_parc_ids())));

DROP POLICY IF EXISTS "staff_son_parc" ON parcs;
CREATE POLICY "staff_son_parc" ON parcs
  FOR SELECT TO authenticated
  USING ((current_role_code() = 'staff_operationnel'::role_utilisateur) AND (id = ANY (current_parc_ids())));

DROP POLICY IF EXISTS "tech_lecture_parcs" ON parcs;
CREATE POLICY "tech_lecture_parcs" ON parcs
  FOR SELECT TO authenticated
  USING (current_role_code() = 'technicien'::role_utilisateur);

-- ============================================================
-- EQUIPEMENTS
-- ============================================================

DROP POLICY IF EXISTS "equip_direction_total" ON equipements;
CREATE POLICY "equip_direction_total" ON equipements
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]));

DROP POLICY IF EXISTS "equip_manager_parc" ON equipements;
CREATE POLICY "equip_manager_parc" ON equipements
  FOR ALL TO authenticated
  USING ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())))
  WITH CHECK ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())));

DROP POLICY IF EXISTS "equip_staff_parc" ON equipements;
CREATE POLICY "equip_staff_parc" ON equipements
  FOR SELECT TO authenticated
  USING ((current_role_code() = 'staff_operationnel'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())));

-- ============================================================
-- INCIDENTS
-- ============================================================

DROP POLICY IF EXISTS "inc_direction_total" ON incidents;
CREATE POLICY "inc_direction_total" ON incidents
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]));

DROP POLICY IF EXISTS "inc_manager_parc" ON incidents;
CREATE POLICY "inc_manager_parc" ON incidents
  FOR ALL TO authenticated
  USING ((current_role_code() = 'manager_parc'::role_utilisateur) AND (equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY (current_parc_ids()))))
  WITH CHECK ((current_role_code() = 'manager_parc'::role_utilisateur) AND (equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY (current_parc_ids()))));

DROP POLICY IF EXISTS "inc_staff_parc_lecture" ON incidents;
CREATE POLICY "inc_staff_parc_lecture" ON incidents
  FOR SELECT TO authenticated
  USING ((current_role_code() = 'staff_operationnel'::role_utilisateur) AND (equipement_id IN (SELECT id FROM equipements WHERE parc_id = ANY (current_parc_ids()))));

-- ============================================================
-- INVITATIONS
-- ============================================================

DROP POLICY IF EXISTS "invit_direction_total" ON invitations;
CREATE POLICY "invit_direction_total" ON invitations
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]));

-- ============================================================
-- NOTES_CHANTIER
-- ============================================================

DROP POLICY IF EXISTS "notes_direction_total" ON notes_chantier;
CREATE POLICY "notes_direction_total" ON notes_chantier
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]));

DROP POLICY IF EXISTS "notes_manager_lecture_son_parc" ON notes_chantier;
CREATE POLICY "notes_manager_lecture_son_parc" ON notes_chantier
  FOR SELECT TO authenticated
  USING ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())));

-- ============================================================
-- FUNCTIONS_SECURITY_POLICY
-- ============================================================

DROP POLICY IF EXISTS "fsp_read_admins" ON functions_security_policy;
CREATE POLICY "fsp_read_admins" ON functions_security_policy
  FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur]));

DROP POLICY IF EXISTS "fsp_write_admins" ON functions_security_policy;
CREATE POLICY "fsp_write_admins" ON functions_security_policy
  FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur]));

-- ============================================================
-- GPS_POSITIONS
-- ============================================================

DROP POLICY IF EXISTS "gps_direction" ON gps_positions;
CREATE POLICY "gps_direction" ON gps_positions
  FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]));

DROP POLICY IF EXISTS "gps_self" ON gps_positions;
CREATE POLICY "gps_self" ON gps_positions
  FOR SELECT TO authenticated
  USING (technicien_id = current_utilisateur_id());
