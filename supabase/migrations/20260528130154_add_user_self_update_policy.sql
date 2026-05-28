/*
  # Add self-update policy on utilisateurs table

  1. Problem
    - Users (manager_parc, technicien, staff) cannot update their own row in `utilisateurs`
    - This causes `tour_vu`, `consentement_gps`, and profile updates to silently fail
    - The guided tour reappears on every login because `tour_vu` never persists

  2. Fix
    - Add a policy allowing authenticated users to UPDATE their own row
    - Restricted to rows where `auth_user_id = auth.uid()`
    - WITH CHECK ensures they can only write to their own row

  3. Security
    - Only allows updating the user's own record (ownership check)
    - Combined with column-level logic in the app, this is safe
*/

CREATE POLICY "user_self_update"
  ON utilisateurs
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
