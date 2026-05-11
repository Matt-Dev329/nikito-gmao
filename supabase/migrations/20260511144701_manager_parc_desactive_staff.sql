/*
  # Manager parc peut desactiver uniquement les staff operationnels

  1. Changements
    - Ajout de deux policies RLS sur `utilisateurs` permettant au role `manager_parc`
      de faire SELECT et UPDATE uniquement sur les utilisateurs dont le role est
      `staff_operationnel`.
    - La desactivation passe par un UPDATE `actif=false, statut_validation='desactive'`
      (pas de DELETE), la policy autorise donc uniquement cet update sur les staff.

  2. Securite
    - Un manager ne peut pas modifier direction / chef_maintenance / technicien /
      autres managers, seulement les staff operationnels.
    - Les policies existantes (direction, chef_maintenance, self) ne sont pas modifiees.
*/

DROP POLICY IF EXISTS "manager_parc_select_staff" ON utilisateurs;
CREATE POLICY "manager_parc_select_staff"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (
    current_role_code() = 'manager_parc'::role_utilisateur
    AND role_id IN (SELECT id FROM roles WHERE code = 'staff_operationnel')
  );

DROP POLICY IF EXISTS "manager_parc_update_staff" ON utilisateurs;
CREATE POLICY "manager_parc_update_staff"
  ON utilisateurs
  FOR UPDATE
  TO authenticated
  USING (
    current_role_code() = 'manager_parc'::role_utilisateur
    AND role_id IN (SELECT id FROM roles WHERE code = 'staff_operationnel')
  )
  WITH CHECK (
    current_role_code() = 'manager_parc'::role_utilisateur
    AND role_id IN (SELECT id FROM roles WHERE code = 'staff_operationnel')
  );
