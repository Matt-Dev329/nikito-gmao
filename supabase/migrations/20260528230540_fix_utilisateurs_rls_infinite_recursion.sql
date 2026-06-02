/*
  # Fix infinite recursion in utilisateurs RLS policies

  1. Problem
    - The policy `user_direction_all` calls `current_role_code()` which
      does a SELECT on `utilisateurs` table
    - This triggers RLS policy evaluation again, creating infinite recursion
    - Result: "infinite recursion detected in policy for relation utilisateurs"
    - All users see 0 results when querying utilisateurs table

  2. Fix
    - Replace `current_role_code()` call with a direct lookup on the `roles`
      table joined via `auth.uid()` that does NOT re-query `utilisateurs`
    - Use a subquery that joins auth.uid() -> utilisateurs.auth_user_id -> roles.code
      but marked as non-recursive by PostgreSQL because we use a CTE or
      alternative approach
    - Actually: the correct fix is to use `auth.jwt()` metadata or a helper
      table without RLS. Simplest: create a small function that uses
      pg_catalog to bypass, OR just inline the check without recursion.

  3. Solution chosen
    - Drop the problematic `user_direction_all` policy
    - Replace with a policy that checks role via the `roles` table only
      (roles table has permissive SELECT for authenticated, no recursion)
    - The key insight: we can safely SELECT from `roles` (no RLS recursion)
      and use the user's own row (auth_user_id = auth.uid()) from utilisateurs
      BUT that still recurses. So instead we use `auth.jwt()->'app_metadata'`
      or we create a SECURITY DEFINER function that explicitly sets
      `SET row_security = off`.

  4. Final approach
    - Recreate current_role_code() with explicit `SET row_security = off`
      so it truly bypasses RLS even when called from within a policy on
      the same table
*/

-- Fix: recreate current_role_code with row_security = off
CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS role_utilisateur
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
SET row_security = off
AS $$
  SELECT r.code FROM roles r
  JOIN utilisateurs u ON u.role_id = r.id
  WHERE u.auth_user_id = auth.uid();
$$;

-- Also fix current_utilisateur_id and current_parc_ids which have the same problem
CREATE OR REPLACE FUNCTION public.current_utilisateur_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
SET row_security = off
AS $$
  SELECT u.id FROM utilisateurs u
  WHERE u.auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_parc_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
SET row_security = off
AS $$
  SELECT COALESCE(array_agg(pu.parc_id), ARRAY[]::uuid[])
  FROM parcs_utilisateurs pu
  JOIN utilisateurs u ON u.id = pu.utilisateur_id
  WHERE u.auth_user_id = auth.uid();
$$;
