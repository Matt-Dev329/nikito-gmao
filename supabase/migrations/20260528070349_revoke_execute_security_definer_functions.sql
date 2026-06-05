/*
  # Revoke unauthorized EXECUTE on SECURITY DEFINER functions

  1. Trigger functions (must NEVER be callable via RPC)
    - `auto_create_incident` - internal trigger, no direct access
    - `fn_notify_arcade_incident_resolu` - internal trigger, no direct access

  2. Auth-only functions (revoke anon, keep authenticated)
    - `current_parc_ids` - returns parc IDs for current user
    - `current_role_code` - returns role code for current user
    - `current_utilisateur_id` - returns utilisateur ID for current user
    - `enregistrer_device` - registers a device for 2FA
    - `rafraichir_device` - refreshes device last-seen timestamp
    - `is_parc_en_production` - checks if parc is in production mode
    - `saisir_point_controle` - records a control point entry
    - `valider_controle` - validates a completed control
    - `modifier_utilisateur` - modifies user (admin action)
    - `hash_and_set_pin` - sets PIN hash for user
    - `set_pin_hash` - sets PIN hash for user

  3. Pre-auth functions (anon MUST be able to call these)
    - `accepter_invitation` - called during invitation acceptance before full auth
    - `verifier_code_2fa` - 2FA code verification during login
    - `verifier_device_reconnu` - device check during login
    - `verifier_pin_staff` - PIN verification for staff login
    - `valider_controle_staff` - staff control validation via PIN auth

  4. Security notes
    - All trigger functions have EXECUTE revoked from both anon and authenticated
    - Internal helper functions restricted to authenticated only
    - Pre-auth functions intentionally left accessible to anon (required for login flows)
*/

-- ============================================================
-- 1. TRIGGER FUNCTIONS: revoke all direct RPC access
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.auto_create_incident() FROM anon;

REVOKE EXECUTE ON FUNCTION public.auto_create_incident() FROM authenticated;


REVOKE EXECUTE ON FUNCTION public.fn_notify_arcade_incident_resolu() FROM anon;

REVOKE EXECUTE ON FUNCTION public.fn_notify_arcade_incident_resolu() FROM authenticated;


-- ============================================================
-- 2. AUTH-ONLY FUNCTIONS: revoke anon, keep authenticated
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.current_parc_ids() FROM anon;

REVOKE EXECUTE ON FUNCTION public.current_role_code() FROM anon;

REVOKE EXECUTE ON FUNCTION public.current_utilisateur_id() FROM anon;

REVOKE EXECUTE ON FUNCTION public.enregistrer_device(text, text, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.rafraichir_device(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.is_parc_en_production(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.saisir_point_controle(uuid, uuid, public.etat_controle_item, uuid, text, text, uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.valider_controle(uuid, uuid, text, text, text, boolean) FROM anon;

REVOKE EXECUTE ON FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) FROM anon;

REVOKE EXECUTE ON FUNCTION public.hash_and_set_pin(uuid, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.set_pin_hash(uuid, text) FROM anon;


-- ============================================================
-- 3. PRE-AUTH FUNCTIONS: intentionally left accessible to anon
--    (accepter_invitation, verifier_code_2fa, verifier_device_reconnu,
--     verifier_pin_staff, valider_controle_staff)
--    No changes needed - these are correctly accessible.
-- ============================================================
;
