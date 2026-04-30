/*
  # Auto-generate numero_prescription + update modifie_le

  1. New Function
    - `fn_generate_numero_prescription()` (SECURITY DEFINER)
      - On INSERT: if numero_prescription is NULL, generates format PR-YYYY-0001
      - On INSERT/UPDATE: sets modifie_le = now()

  2. Trigger
    - `trg_generate_numero_prescription` BEFORE INSERT OR UPDATE on prescriptions_securite

  3. Security
    - REVOKE EXECUTE from public, anon, authenticated (only callable via trigger)
*/

CREATE OR REPLACE FUNCTION fn_generate_numero_prescription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_count int;
BEGIN
  IF NEW.numero_prescription IS NULL THEN
    v_year := to_char(now(), 'YYYY');
    SELECT count(*) + 1 INTO v_count
    FROM prescriptions_securite
    WHERE EXTRACT(YEAR FROM cree_le) = EXTRACT(YEAR FROM now());
    NEW.numero_prescription := 'PR-' || v_year || '-' || lpad(v_count::text, 4, '0');
  END IF;
  NEW.modifie_le := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_numero_prescription
  BEFORE INSERT OR UPDATE ON prescriptions_securite
  FOR EACH ROW EXECUTE FUNCTION fn_generate_numero_prescription();

REVOKE EXECUTE ON FUNCTION fn_generate_numero_prescription() FROM public, anon, authenticated;
