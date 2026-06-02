/*
  # Restore EXECUTE on RLS helper functions for authenticated

  1. Problem
    - RLS policies execute in the context of the calling role (anon/authenticated)
    - When a policy calls current_parc_ids(), it runs AS the authenticated user
    - Revoking EXECUTE from authenticated broke ALL data access (app stuck on loading)

  2. Fix
    - Re-grant EXECUTE to authenticated on RLS helper functions
    - These MUST remain callable by authenticated for RLS policies to work
    - anon does NOT need them (anon has no data access via RLS anyway)

  3. Functions restored
    - `current_parc_ids()` - used in RLS policies
    - `current_role_code()` - used in RLS policies  
    - `current_utilisateur_id()` - used in RLS policies
    - `is_parc_en_production(uuid)` - used in RLS policies

  4. Security note
    - These functions are SECURITY DEFINER so they can bypass RLS on the tables
      they query (utilisateurs, parcs_utilisateurs, etc.)
    - They MUST be callable by authenticated because RLS policies run in that context
    - The Supabase security advisor warning is expected and intentional for these
*/

GRANT EXECUTE ON FUNCTION public.current_parc_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_utilisateur_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parc_en_production(uuid) TO authenticated;
