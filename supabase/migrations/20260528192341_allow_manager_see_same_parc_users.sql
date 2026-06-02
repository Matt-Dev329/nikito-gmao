/*
  # Allow managers to see other users in their parks

  1. Problem
    - Managers can only see staff_operationnel users via `manager_parc_select_staff`
    - They cannot see other managers assigned to the same parks
    - This prevents team collaboration and profile visibility

  2. Fix
    - Add SELECT policy allowing managers to see any user assigned to their parks
    - Uses parcs_utilisateurs junction table to check shared park membership

  3. Security
    - Only managers can use this policy (role check)
    - Only shows users who share at least one park with the current manager
    - Read-only access (SELECT only)
*/

CREATE POLICY "manager_parc_select_same_parc_users"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (
    current_role_code() = 'manager_parc'
    AND EXISTS (
      SELECT 1
      FROM parcs_utilisateurs pu_them
      JOIN parcs_utilisateurs pu_me
        ON pu_me.parc_id = pu_them.parc_id
      WHERE pu_them.utilisateur_id = utilisateurs.id
        AND pu_me.utilisateur_id = (
          SELECT u.id FROM utilisateurs u WHERE u.auth_user_id = auth.uid()
        )
    )
  );
