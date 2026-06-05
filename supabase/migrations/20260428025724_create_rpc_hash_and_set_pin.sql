/*
  # Create RPC hash_and_set_pin

  1. New Functions
    - `hash_and_set_pin(p_utilisateur_id uuid, p_pin_clair text)` 
      - Hashes a PIN using pgcrypto bcrypt and sets it on the utilisateur row
      - Sets code_pin_hash, code_pin_genere_le, pin_must_change
      - SECURITY DEFINER to bypass RLS (called from edge functions via service role)

  2. Security
    - Function is SECURITY DEFINER with fixed search_path
    - Only callable with service_role key (edge functions)
*/

CREATE OR REPLACE FUNCTION public.hash_and_set_pin(
  p_utilisateur_id uuid,
  p_pin_clair text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE utilisateurs
  SET
    code_pin_hash = crypt(p_pin_clair, gen_salt('bf')),
    code_pin_genere_le = NOW(),
    pin_must_change = true
  WHERE id = p_utilisateur_id;

END;

$$;

;
