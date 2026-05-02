/*
  # Masquer les prescriptions en brouillon et rejetees aux techniciens/staff

  - Les techniciens et staff operationnel ne doivent voir que les prescriptions
    actives (a_lever, en_cours, levee_proposee, levee_validee, caduque).
  - Direction, admin_it, chef_maintenance et manager_parc voient tous les statuts.
*/

DROP POLICY IF EXISTS "prescriptions_read" ON prescriptions_securite;

CREATE POLICY "prescriptions_read"
  ON prescriptions_securite FOR SELECT
  TO authenticated
  USING (
    (
      current_role_code() IN ('direction', 'admin_it', 'chef_maintenance')
      OR (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()))
    )
    OR (
      parc_id = ANY(current_parc_ids())
      AND statut NOT IN ('brouillon', 'rejete_extraction')
    )
  );

-- Register new function in policy table if needed (no new functions here)
