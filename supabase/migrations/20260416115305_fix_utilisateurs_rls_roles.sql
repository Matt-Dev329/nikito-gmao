/*
  # Fix RLS policies on utilisateurs table

  1. Problem
    - Existing RLS policies `user_self_read` and `user_direction_all` target `public` role
    - Supabase PostgREST uses `authenticated` role for logged-in users
    - This means authenticated users cannot read from `utilisateurs` table at all
    - Results in infinite "Chargement..." loading screen

  2. Changes
    - Drop existing policies targeting wrong role
    - Recreate same policies targeting `authenticated` role

  3. Security
    - `user_self_read`: authenticated users can SELECT their own row (auth_user_id = auth.uid())
    - `user_direction_all`: direction/chef_maintenance can do ALL operations
*/

DROP POLICY IF EXISTS "user_self_read" ON utilisateurs;
DROP POLICY IF EXISTS "user_direction_all" ON utilisateurs;

CREATE POLICY "user_self_read"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "user_direction_all"
  ON utilisateurs
  FOR ALL
  TO authenticated
  USING (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
  WITH CHECK (current_role_code() = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]));
