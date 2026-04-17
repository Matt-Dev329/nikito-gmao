/*
  # Fix security warnings on DGCCRF functions and audit policy

  1. Functions modified
    - `fn_immutabilite_controles` — search_path fixed to `public`
    - `fn_immutabilite_items` — search_path fixed to `public`
    - `fn_correction_controles` — search_path fixed to `public`

  2. Security changes
    - Replaced `audit_insert_authentifie` policy on `controles_audit_log`
      with a stricter version that verifies the referenced controle_id exists
*/

ALTER FUNCTION fn_immutabilite_controles() SET search_path = public;
ALTER FUNCTION fn_immutabilite_items() SET search_path = public;
ALTER FUNCTION fn_correction_controles() SET search_path = public;

DROP POLICY IF EXISTS "audit_insert_authentifie" ON controles_audit_log;

CREATE POLICY "audit_insert_authentifie"
  ON controles_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM controles WHERE id = controles_audit_log.controle_id)
  );
