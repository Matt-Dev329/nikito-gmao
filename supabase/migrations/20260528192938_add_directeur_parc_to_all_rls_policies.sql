/*
  # Add directeur_parc to all RLS policies

  1. Changes
    - Updates all existing RLS policies that reference chef_maintenance
      to also include directeur_parc
    - Directeur de parc has same access as chef_maintenance everywhere

  2. Tables affected
    - utilisateurs, controles, controle_items, controles_audit_log
    - equipements, incidents, interventions, invitations
    - fiches_5_pourquoi, certifications, maintenances_preventives
    - bibliotheque_points, categories_equipement, fixtures_lumiere
    - fournisseurs, zones, standards_evolutifs, parc_attractions
    - pieces_detachees, pieces_utilisees, plaintes_clients
    - archives_pdf, notes_chantier, gps_positions
    - parcs, parcs_utilisateurs, parc_points_actifs
    - vehicules, vehicules_positions
    - hypotheses_ia, historique_decisions_ia, rapports_ia_hebdo
    - acteurs_chantier, commissions_securite, documents_chantier
    - parcs_phases, prescriptions_securite, extractions_pv
    - symptomes, trackers_sync_log
    - storage.objects (alba buckets, conformite, manuels, rapports)

  3. Security
    - directeur_parc gets identical access to chef_maintenance
    - No permissions are removed, only added
*/

-- Helper: update policies that use current_role_code() pattern
-- We drop and recreate each policy

-- utilisateurs.user_direction_all
DROP POLICY IF EXISTS "user_direction_all" ON utilisateurs;
CREATE POLICY "user_direction_all" ON utilisateurs FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- controles.ctrl_select_direction_cm
DROP POLICY IF EXISTS "ctrl_select_direction_cm" ON controles;
CREATE POLICY "ctrl_select_direction_cm" ON controles FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- controles.ctrl_insert_roles_metier
DROP POLICY IF EXISTS "ctrl_insert_roles_metier" ON controles;
CREATE POLICY "ctrl_insert_roles_metier" ON controles FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]));

-- controles.ctrl_update_roles_metier
DROP POLICY IF EXISTS "ctrl_update_roles_metier" ON controles;
CREATE POLICY "ctrl_update_roles_metier" ON controles FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]));

-- controle_items.items_insert_roles_metier
DROP POLICY IF EXISTS "items_insert_roles_metier" ON controle_items;
CREATE POLICY "items_insert_roles_metier" ON controle_items FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]));

-- controle_items.items_update_roles_metier
DROP POLICY IF EXISTS "items_update_roles_metier" ON controle_items;
CREATE POLICY "items_update_roles_metier" ON controle_items FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'technicien'::role_utilisateur, 'staff_operationnel'::role_utilisateur]));

-- controles_audit_log.audit_select_direction_cm
DROP POLICY IF EXISTS "audit_select_direction_cm" ON controles_audit_log;
CREATE POLICY "audit_select_direction_cm" ON controles_audit_log FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- equipements.equip_direction_total
DROP POLICY IF EXISTS "equip_direction_total" ON equipements;
CREATE POLICY "equip_direction_total" ON equipements FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- incidents.inc_direction_total
DROP POLICY IF EXISTS "inc_direction_total" ON incidents;
CREATE POLICY "inc_direction_total" ON incidents FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- interventions.interv_ecriture_techniciens
DROP POLICY IF EXISTS "interv_ecriture_techniciens" ON interventions;
CREATE POLICY "interv_ecriture_techniciens" ON interventions FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- invitations.invit_direction_total
DROP POLICY IF EXISTS "invit_direction_total" ON invitations;
CREATE POLICY "invit_direction_total" ON invitations FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- fiches_5_pourquoi
DROP POLICY IF EXISTS "5p_creation_techniciens" ON fiches_5_pourquoi;
CREATE POLICY "5p_creation_techniciens" ON fiches_5_pourquoi FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

DROP POLICY IF EXISTS "5p_modification_techniciens" ON fiches_5_pourquoi;
CREATE POLICY "5p_modification_techniciens" ON fiches_5_pourquoi FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- certifications
DROP POLICY IF EXISTS "certifs_ecriture_admin" ON certifications;
CREATE POLICY "certifs_ecriture_admin" ON certifications FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- maintenances_preventives
DROP POLICY IF EXISTS "preventif_ecriture_admin" ON maintenances_preventives;
CREATE POLICY "preventif_ecriture_admin" ON maintenances_preventives FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- bibliotheque_points
DROP POLICY IF EXISTS "biblio_ecriture_admin" ON bibliotheque_points;
CREATE POLICY "biblio_ecriture_admin" ON bibliotheque_points FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- categories_equipement
DROP POLICY IF EXISTS "categories_ecriture_admin" ON categories_equipement;
CREATE POLICY "categories_ecriture_admin" ON categories_equipement FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- fixtures_lumiere
DROP POLICY IF EXISTS "fixtures_ecriture_admin" ON fixtures_lumiere;
CREATE POLICY "fixtures_ecriture_admin" ON fixtures_lumiere FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- fournisseurs
DROP POLICY IF EXISTS "fournisseurs_ecriture_admin" ON fournisseurs;
CREATE POLICY "fournisseurs_ecriture_admin" ON fournisseurs FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- zones
DROP POLICY IF EXISTS "zones_ecriture_admin" ON zones;
CREATE POLICY "zones_ecriture_admin" ON zones FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- standards_evolutifs
DROP POLICY IF EXISTS "standards_ecriture_admin" ON standards_evolutifs;
CREATE POLICY "standards_ecriture_admin" ON standards_evolutifs FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- parc_attractions
DROP POLICY IF EXISTS "attractions_ecriture_admin" ON parc_attractions;
CREATE POLICY "attractions_ecriture_admin" ON parc_attractions FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- pieces_detachees
DROP POLICY IF EXISTS "pieces_ecriture_techniciens" ON pieces_detachees;
CREATE POLICY "pieces_ecriture_techniciens" ON pieces_detachees FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- pieces_utilisees
DROP POLICY IF EXISTS "pieces_util_ecriture_techniciens" ON pieces_utilisees;
CREATE POLICY "pieces_util_ecriture_techniciens" ON pieces_utilisees FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- plaintes_clients
DROP POLICY IF EXISTS "plaintes_creation_roles_metier" ON plaintes_clients;
CREATE POLICY "plaintes_creation_roles_metier" ON plaintes_clients FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur, 'staff_operationnel'::role_utilisateur]));

DROP POLICY IF EXISTS "plaintes_modif_admin" ON plaintes_clients;
CREATE POLICY "plaintes_modif_admin" ON plaintes_clients FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]));

-- archives_pdf
DROP POLICY IF EXISTS "archives_creation_systeme" ON archives_pdf;
CREATE POLICY "archives_creation_systeme" ON archives_pdf FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'technicien'::role_utilisateur]));

-- notes_chantier
DROP POLICY IF EXISTS "notes_direction_total" ON notes_chantier;
CREATE POLICY "notes_direction_total" ON notes_chantier FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- gps_positions
DROP POLICY IF EXISTS "gps_direction" ON gps_positions;
CREATE POLICY "gps_direction" ON gps_positions FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- parcs.direction_total_access
DROP POLICY IF EXISTS "direction_total_access" ON parcs;
CREATE POLICY "direction_total_access" ON parcs FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- parcs_utilisateurs.pu_lecture_admin
DROP POLICY IF EXISTS "pu_lecture_admin" ON parcs_utilisateurs;
CREATE POLICY "pu_lecture_admin" ON parcs_utilisateurs FOR SELECT TO authenticated
  USING ((current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])) OR (utilisateur_id = current_utilisateur_id()));

-- parc_points_actifs
DROP POLICY IF EXISTS "ppa_modify_direction_chef" ON parc_points_actifs;
CREATE POLICY "ppa_modify_direction_chef" ON parc_points_actifs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- vehicules
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicules;
CREATE POLICY "Authenticated users can view vehicles" ON vehicules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Direction and chefs can insert vehicles" ON vehicules;
CREATE POLICY "Direction and chefs can insert vehicles" ON vehicules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Direction and chefs can update vehicles" ON vehicules;
CREATE POLICY "Direction and chefs can update vehicles" ON vehicules FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- vehicules_positions
DROP POLICY IF EXISTS "Authenticated users can insert vehicle positions" ON vehicules_positions;
CREATE POLICY "Authenticated users can insert vehicle positions" ON vehicules_positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Authenticated users can view vehicle positions" ON vehicules_positions;
CREATE POLICY "Authenticated users can view vehicle positions" ON vehicules_positions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- hypotheses_ia
DROP POLICY IF EXISTS "Direction et chefs peuvent lire les hypotheses" ON hypotheses_ia;
CREATE POLICY "Direction et chefs peuvent lire les hypotheses" ON hypotheses_ia FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Direction et chefs peuvent creer des hypotheses" ON hypotheses_ia;
CREATE POLICY "Direction et chefs peuvent creer des hypotheses" ON hypotheses_ia FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Direction et chefs peuvent valider les hypotheses" ON hypotheses_ia;
CREATE POLICY "Direction et chefs peuvent valider les hypotheses" ON hypotheses_ia FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- historique_decisions_ia
DROP POLICY IF EXISTS "Direction et chefs lisent historique decisions" ON historique_decisions_ia;
CREATE POLICY "Direction et chefs lisent historique decisions" ON historique_decisions_ia FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Direction et chefs inserent historique decisions" ON historique_decisions_ia;
CREATE POLICY "Direction et chefs inserent historique decisions" ON historique_decisions_ia FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- rapports_ia_hebdo
DROP POLICY IF EXISTS "Direction et chefs peuvent lire les rapports IA" ON rapports_ia_hebdo;
CREATE POLICY "Direction et chefs peuvent lire les rapports IA" ON rapports_ia_hebdo FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

DROP POLICY IF EXISTS "Insertion rapports IA via service role uniquement" ON rapports_ia_hebdo;
CREATE POLICY "Insertion rapports IA via service role uniquement" ON rapports_ia_hebdo FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.auth_user_id = auth.uid()
      AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
  ));

-- acteurs_chantier
DROP POLICY IF EXISTS "acteurs_write" ON acteurs_chantier;
CREATE POLICY "acteurs_write" ON acteurs_chantier FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- commissions_securite
DROP POLICY IF EXISTS "commissions_write" ON commissions_securite;
CREATE POLICY "commissions_write" ON commissions_securite FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- documents_chantier
DROP POLICY IF EXISTS "documents_write" ON documents_chantier;
CREATE POLICY "documents_write" ON documents_chantier FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur]));

-- parcs_phases
DROP POLICY IF EXISTS "phases_write" ON parcs_phases;
CREATE POLICY "phases_write" ON parcs_phases FOR ALL TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- prescriptions_securite
DROP POLICY IF EXISTS "prescriptions_read" ON prescriptions_securite;
CREATE POLICY "prescriptions_read" ON prescriptions_securite FOR SELECT TO authenticated
  USING (
    (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
    OR ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())))
    OR ((parc_id = ANY (current_parc_ids())) AND (statut NOT IN ('brouillon', 'rejete_extraction')))
  );

DROP POLICY IF EXISTS "prescriptions_insert" ON prescriptions_securite;
CREATE POLICY "prescriptions_insert" ON prescriptions_securite FOR INSERT TO authenticated
  WITH CHECK (
    (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
    OR ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())))
  );

DROP POLICY IF EXISTS "prescriptions_update" ON prescriptions_securite;
CREATE POLICY "prescriptions_update" ON prescriptions_securite FOR UPDATE TO authenticated
  USING (
    (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
    OR ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())))
    OR (responsable_id = current_utilisateur_id())
  )
  WITH CHECK (
    (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
    OR ((current_role_code() = 'manager_parc'::role_utilisateur) AND (parc_id = ANY (current_parc_ids())))
    OR (responsable_id = current_utilisateur_id())
  );

-- extractions_pv
DROP POLICY IF EXISTS "extractions_pv_insert" ON extractions_pv;
CREATE POLICY "extractions_pv_insert" ON extractions_pv FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

DROP POLICY IF EXISTS "extractions_pv_update" ON extractions_pv;
CREATE POLICY "extractions_pv_update" ON extractions_pv FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- symptomes
DROP POLICY IF EXISTS "symptomes_insert_direction_admin" ON symptomes;
CREATE POLICY "symptomes_insert_direction_admin" ON symptomes FOR INSERT TO authenticated
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

DROP POLICY IF EXISTS "symptomes_update_direction_admin" ON symptomes;
CREATE POLICY "symptomes_update_direction_admin" ON symptomes FOR UPDATE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

DROP POLICY IF EXISTS "symptomes_delete_direction_admin" ON symptomes;
CREATE POLICY "symptomes_delete_direction_admin" ON symptomes FOR DELETE TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur]));

-- trackers_sync_log
DROP POLICY IF EXISTS "trackers_sync_log_lecture" ON trackers_sync_log;
CREATE POLICY "trackers_sync_log_lecture" ON trackers_sync_log FOR SELECT TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'admin_it'::role_utilisateur]));

-- storage.objects policies
DROP POLICY IF EXISTS "alba_privileged_delete" ON storage.objects;
CREATE POLICY "alba_privileged_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['alba-controles','alba-documents','alba-equipements','alba-incidents','alba-interventions','alba-signatures'])
    AND EXISTS (
      SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
      WHERE u.auth_user_id = auth.uid() AND u.actif = true
        AND r.code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
    )
  );

DROP POLICY IF EXISTS "conformite_docs_upload" ON storage.objects;
CREATE POLICY "conformite_docs_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'conformite-documents'
    AND current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'admin_it'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'manager_parc'::role_utilisateur])
  );

DROP POLICY IF EXISTS "manuels_equipements_insert" ON storage.objects;
CREATE POLICY "manuels_equipements_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'manuels-equipements'
    AND current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'admin_it'::role_utilisateur])
  );

DROP POLICY IF EXISTS "rapports_insert" ON storage.objects;
CREATE POLICY "rapports_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rapports'
    AND current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur, 'admin_it'::role_utilisateur])
  );
