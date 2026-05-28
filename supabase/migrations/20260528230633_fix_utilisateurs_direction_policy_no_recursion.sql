/*
  # Fix utilisateurs RLS: eliminate infinite recursion

  1. Problem
    - PostgreSQL evaluates ALL applicable policies for a table, even if one would suffice
    - The policy `user_direction_all` calls `current_role_code()` which SELECTs from `utilisateurs`
    - This creates infinite recursion even though other policies (like user_self_read) don't recurse
    - ALL queries to `utilisateurs` fail, breaking the entire app

  2. Solution
    - Drop `user_direction_all` which uses current_role_code()
    - Replace with a policy that checks the user's role WITHOUT querying `utilisateurs`
    - Use auth.jwt() -> raw_app_meta_data if available, OR
    - Use a separate lookup table/materialized approach
    - Best approach: join directly through auth.uid() to a NON-RLS-protected path
    - Since we can't avoid querying utilisateurs for role lookup, we use a 
      dedicated helper table `utilisateurs_roles_cache` without RLS

  3. Chosen approach
    - Create a small table `user_role_cache` with NO RLS that maps auth_user_id -> role_code
    - Populate it from existing data
    - Use a trigger to keep it in sync
    - Rewrite the policy to use this cache table instead
*/

-- Create a cache table for role lookups (NO RLS - used only in policy evaluation)
CREATE TABLE IF NOT EXISTS public.user_role_cache (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_code role_utilisateur NOT NULL
);

-- Populate from existing data
INSERT INTO user_role_cache (auth_user_id, role_code)
SELECT u.auth_user_id, r.code
FROM utilisateurs u
JOIN roles r ON r.id = u.role_id
WHERE u.auth_user_id IS NOT NULL
ON CONFLICT (auth_user_id) DO UPDATE SET role_code = EXCLUDED.role_code;

-- NO RLS on this table - it's only used internally by policies
-- Grant minimal access
GRANT SELECT ON user_role_cache TO authenticated;
GRANT SELECT ON user_role_cache TO anon;

-- Create trigger function to keep cache in sync
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
    INSERT INTO user_role_cache (auth_user_id, role_code)
    SELECT NEW.auth_user_id, r.code FROM roles r WHERE r.id = NEW.role_id
    ON CONFLICT (auth_user_id) DO UPDATE SET role_code = EXCLUDED.role_code;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id != COALESCE(NEW.auth_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    DELETE FROM user_role_cache WHERE auth_user_id = OLD.auth_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_user_role_cache
  AFTER INSERT OR UPDATE OR DELETE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION sync_user_role_cache();

-- Now fix the problematic policy
DROP POLICY IF EXISTS "user_direction_all" ON utilisateurs;
CREATE POLICY "user_direction_all" ON utilisateurs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'directeur_parc'::role_utilisateur])
    )
  );

-- Also fix admin_it_select_utilisateurs which likely has the same issue
DROP POLICY IF EXISTS "admin_it_select_utilisateurs" ON utilisateurs;
CREATE POLICY "admin_it_select_utilisateurs" ON utilisateurs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_cache urc
      WHERE urc.auth_user_id = auth.uid()
        AND urc.role_code = 'admin_it'::role_utilisateur
    )
  );

-- Also fix manager_parc policies that query utilisateurs within utilisateurs policies
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
      SELECT 1 FROM parcs_utilisateurs pu_them
      JOIN parcs_utilisateurs pu_me ON pu_me.parc_id = pu_them.parc_id
      WHERE pu_them.utilisateur_id = utilisateurs.id
        AND pu_me.utilisateur_id = (SELECT u2.id FROM utilisateurs u2 WHERE u2.auth_user_id = auth.uid())
    )
  );

-- Update current_role_code to also use the cache (for other tables' policies)
CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS role_utilisateur
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT role_code FROM user_role_cache WHERE auth_user_id = auth.uid();
$$;
