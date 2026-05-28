/*
  # Revoke PUBLIC default EXECUTE on all SECURITY DEFINER functions

  1. Problem
    - PostgreSQL grants EXECUTE to PUBLIC by default on all functions
    - anon and authenticated inherit from PUBLIC, so REVOKE on them alone is insufficient
    - Must REVOKE from PUBLIC first, then explicitly GRANT only to needed roles

  2. Functions affected (all SECURITY DEFINER in public schema)
    - Trigger functions: auto_create_incident, fn_notify_arcade_incident_resolu
    - RLS helpers: current_parc_ids, current_role_code, current_utilisateur_id, is_parc_en_production
    - Internal: hash_and_set_pin, set_pin_hash
    - Auth-only: enregistrer_device, rafraichir_device, modifier_utilisateur,
      saisir_point_controle, valider_controle
    - Pre-auth (anon needed): accepter_invitation, verifier_code_2fa,
      verifier_device_reconnu, verifier_pin_staff, valider_controle_staff

  3. Security approach
    - Revoke ALL from PUBLIC on every function
    - Re-grant to authenticated for functions called by the frontend
    - Re-grant to anon ONLY for pre-auth functions required during login flows
    - Trigger and RLS helper functions get NO grants (they run as owner via triggers/policies)
*/

-- ============================================================
-- STEP 1: Revoke PUBLIC on ALL security definer functions
-- ============================================================

-- Trigger functions
REVOKE EXECUTE ON FUNCTION public.auto_create_incident() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_notify_arcade_incident_resolu() FROM PUBLIC;

-- RLS helper functions
REVOKE EXECUTE ON FUNCTION public.current_parc_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_role_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_utilisateur_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_parc_en_production(uuid) FROM PUBLIC;

-- Internal PIN functions
REVOKE EXECUTE ON FUNCTION public.hash_and_set_pin(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_pin_hash(uuid, text) FROM PUBLIC;

-- Auth-only functions
REVOKE EXECUTE ON FUNCTION public.enregistrer_device(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rafraichir_device(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.saisir_point_controle(uuid, uuid, public.etat_controle_item, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.valider_controle(uuid, uuid, text, text, text, boolean) FROM PUBLIC;

-- Pre-auth functions (also revoke PUBLIC, will re-grant to anon explicitly)
REVOKE EXECUTE ON FUNCTION public.accepter_invitation(text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verifier_code_2fa(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verifier_device_reconnu(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verifier_pin_staff(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.valider_controle_staff(uuid, text, date, uuid, text, text, jsonb) FROM PUBLIC;

-- ============================================================
-- STEP 2: Re-grant to authenticated for frontend-called functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.enregistrer_device(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rafraichir_device(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modifier_utilisateur(uuid, uuid, uuid[], boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saisir_point_controle(uuid, uuid, public.etat_controle_item, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_controle(uuid, uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accepter_invitation(text, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verifier_code_2fa(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verifier_device_reconnu(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verifier_pin_staff(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_controle_staff(uuid, text, date, uuid, text, text, jsonb) TO authenticated;

-- ============================================================
-- STEP 3: Grant to anon ONLY for pre-auth functions (login flows)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.accepter_invitation(text, uuid, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verifier_code_2fa(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verifier_device_reconnu(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verifier_pin_staff(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.valider_controle_staff(uuid, text, date, uuid, text, text, jsonb) TO anon;
