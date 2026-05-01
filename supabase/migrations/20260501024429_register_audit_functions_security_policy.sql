/*
  # Register audit trigger functions in security policy table

  1. Changes
    - Registers fn_generate_numero_prescription as internal trigger (no public access)
    - Registers fn_set_audit_fields as internal trigger (no public access)
    - Applies the security policy via apply_function_security_policy()
*/

INSERT INTO functions_security_policy (function_name, function_args, expose_to_anon, expose_to_authenticated, comment) VALUES
  ('fn_generate_numero_prescription', '', false, false, 'Trigger interne'),
  ('fn_set_audit_fields', '', false, false, 'Trigger interne')
ON CONFLICT (function_name) DO UPDATE SET
  expose_to_anon = EXCLUDED.expose_to_anon,
  expose_to_authenticated = EXCLUDED.expose_to_authenticated;

SELECT public.apply_function_security_policy();
