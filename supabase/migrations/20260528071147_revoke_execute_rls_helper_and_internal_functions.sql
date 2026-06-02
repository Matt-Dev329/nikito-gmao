/*
  # Revoke EXECUTE on internal helper functions never called via RPC

  1. RLS helper functions (only used inside RLS policies, never called from frontend)
    - `current_parc_ids` - used in RLS policies only
    - `current_role_code` - used in RLS policies only
    - `current_utilisateur_id` - used in RLS policies only
    - `is_parc_en_production` - used in RLS policies only

  2. Internal functions called only by other functions
    - `hash_and_set_pin` - called internally by accepter_invitation
    - `set_pin_hash` - called internally by accepter_invitation

  3. Security notes
    - These functions are SECURITY DEFINER and are used internally by PostgreSQL
      (via RLS policies or called by other functions)
    - They do NOT need to be callable via the PostgREST /rpc/ endpoint
    - Revoking EXECUTE from anon and authenticated does NOT affect their use
      in RLS policies or inside other SECURITY DEFINER functions because those
      execute as the function owner (postgres), not as anon/authenticated
*/

-- ============================================================
-- RLS helper functions: revoke from authenticated (anon already revoked)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.current_parc_ids() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_role_code() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_utilisateur_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_parc_en_production(uuid) FROM authenticated;

-- ============================================================
-- Internal PIN hash functions: revoke from authenticated (anon already revoked)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.hash_and_set_pin(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_pin_hash(uuid, text) FROM authenticated;
