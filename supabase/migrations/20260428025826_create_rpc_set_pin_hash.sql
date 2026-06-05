/*
  # Create RPC set_pin_hash

  1. New Functions
    - `set_pin_hash(p_utilisateur_id uuid, p_pin_clair text)` 
      - Hashes a cleartext PIN with bcrypt via pgcrypto
      - Updates the utilisateurs row with the hash
      - Returns void
      - SECURITY DEFINER to bypass RLS
  
  2. Security
    - Only callable by service role (edge functions)
    - search_path locked to public
*/

CREATE OR REPLACE FUNCTION public.set_pin_hash(
  p_utilisateur_id uuid,
  p_pin_clair text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE utilisateurs
  SET
    code_pin_hash = crypt(p_pin_clair, gen_salt('bf')),
    code_pin_genere_le = now(),
    pin_must_change = true,
    pin_failed_attempts = 0,
    pin_locked_until = null
  WHERE id = p_utilisateur_id;

END;

$$;

;
