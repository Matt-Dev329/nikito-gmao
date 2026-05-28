/*
  # Fix remaining recursive policies on utilisateurs table

  1. Problem
    - `manager_parc_select_same_parc_users` contains a sub-SELECT on `utilisateurs`
      (`SELECT u2.id FROM utilisateurs u2 WHERE u2.auth_user_id = auth.uid()`)
      which triggers infinite recursion
    - `manager_parc_select_staff` and `manager_parc_update_staff` call current_role_code()
      which now uses user_role_cache (safe), but they still work - just replacing for consistency

  2. Fix
    - Replace the recursive sub-SELECT with a lookup from `user_role_cache` + `parcs_utilisateurs`
      using auth.uid() directly without going through utilisateurs
    - Use a JOIN path: auth.uid() -> user_role_cache (no RLS) for role check
    - For parc membership: use parcs_utilisateurs.utilisateur_id matched via
      a sub-select that gets utilisateur_id from user_role_cache or directly
    - Actually: parcs_utilisateurs references utilisateur_id (not auth_user_id),
      so we need a way to get the utilisateur.id without querying utilisateurs.
    - Solution: add auth_user_id to user_role_cache along with utilisateur_id

  3. Implementation
    - Add utilisateur_id column to user_role_cache
    - Repopulate
    - Rewrite policies to use user_role_cache.utilisateur_id
*/

-- Add utilisateur_id to cache
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_role_cache' AND column_name = 'utilisateur_id'
  ) THEN
    ALTER TABLE user_role_cache ADD COLUMN utilisateur_id uuid;
  END IF;
END $$;

-- Repopulate with utilisateur_id
TRUNCATE user_role_cache;
INSERT INTO user_role_cache (auth_user_id, role_code, utilisateur_id)
SELECT u.auth_user_id, r.code, u.id
FROM utilisateurs u
JOIN roles r ON r.id = u.role_id
WHERE u.auth_user_id IS NOT NULL;

-- Update sync trigger to also set utilisateur_id
CREATE OR REPLACE FUNCTION public.sync_user_role_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_role_cache WHERE auth_user_id = OLD.auth_user_id;
    RETURN OLD;
  END IF;
  
  IF NEW.auth_user_id IS NOT NULL THEN
    INSERT INTO user_role_cache (auth_user_id, role_code, utilisateur_id)
    SELECT NEW.auth_user_id, r.code, NEW.id FROM roles r WHERE r.id = NEW.role_id
    ON CONFLICT (auth_user_id) DO UPDATE SET role_code = EXCLUDED.role_code, utilisateur_id = EXCLUDED.utilisateur_id;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
    DELETE FROM user_role_cache WHERE auth_user_id = OLD.auth_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix manager_parc_select_same_parc_users: no more sub-SELECT on utilisateurs
DROP POLICY IF EXISTS "manager_parc_select_same_parc_users" ON utilisateurs;
CREATE POLICY "manager_parc_select_same_parc_users" ON utilisateurs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = 'manager_parc'::role_utilisateur
    )
    AND EXISTS (
      SELECT 1
      FROM parcs_utilisateurs pu_them
      JOIN parcs_utilisateurs pu_me ON pu_me.parc_id = pu_them.parc_id
      JOIN user_role_cache urc ON urc.utilisateur_id = pu_me.utilisateur_id
      WHERE pu_them.utilisateur_id = utilisateurs.id
        AND urc.auth_user_id = auth.uid()
    )
  );

-- Fix manager_parc_select_staff: use user_role_cache instead of current_role_code()
DROP POLICY IF EXISTS "manager_parc_select_staff" ON utilisateurs;
CREATE POLICY "manager_parc_select_staff" ON utilisateurs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = 'manager_parc'::role_utilisateur
    )
    AND role_id IN (SELECT roles.id FROM roles WHERE roles.code = 'staff_operationnel'::role_utilisateur)
  );

-- Fix manager_parc_update_staff: use user_role_cache instead of current_role_code()
DROP POLICY IF EXISTS "manager_parc_update_staff" ON utilisateurs;
CREATE POLICY "manager_parc_update_staff" ON utilisateurs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = 'manager_parc'::role_utilisateur
    )
    AND role_id IN (SELECT roles.id FROM roles WHERE roles.code = 'staff_operationnel'::role_utilisateur)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = 'manager_parc'::role_utilisateur
    )
    AND role_id IN (SELECT roles.id FROM roles WHERE roles.code = 'staff_operationnel'::role_utilisateur)
  );

-- Also update current_utilisateur_id to use the cache
CREATE OR REPLACE FUNCTION public.current_utilisateur_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT utilisateur_id FROM user_role_cache WHERE auth_user_id = auth.uid();
$$;
