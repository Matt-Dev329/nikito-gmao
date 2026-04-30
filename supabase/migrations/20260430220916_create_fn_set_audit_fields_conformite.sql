/*
  # Generic audit trigger for conformite tables

  1. New Function
    - `fn_set_audit_fields()` (SECURITY DEFINER)
      - On INSERT: sets cree_par_id and modifie_par_id to current utilisateur
      - On UPDATE: preserves cree_par_id, updates modifie_par_id

  2. Triggers attached to 5 tables
    - parcs_phases
    - commissions_securite
    - prescriptions_securite
    - documents_chantier
    - acteurs_chantier

  3. Security
    - REVOKE EXECUTE from public, anon, authenticated (trigger-only)
*/

CREATE OR REPLACE FUNCTION fn_set_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM utilisateurs
  WHERE auth_user_id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    NEW.cree_par_id := v_user_id;
    NEW.modifie_par_id := v_user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.cree_par_id := OLD.cree_par_id;
    NEW.modifie_par_id := v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_set_audit_fields() FROM public, anon, authenticated;

-- Attach to parcs_phases
CREATE TRIGGER trg_audit_parcs_phases
  BEFORE INSERT OR UPDATE ON parcs_phases
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Attach to commissions_securite
CREATE TRIGGER trg_audit_commissions_securite
  BEFORE INSERT OR UPDATE ON commissions_securite
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Attach to prescriptions_securite
CREATE TRIGGER trg_audit_prescriptions_securite
  BEFORE INSERT OR UPDATE ON prescriptions_securite
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Attach to documents_chantier
CREATE TRIGGER trg_audit_documents_chantier
  BEFORE INSERT OR UPDATE ON documents_chantier
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Attach to acteurs_chantier
CREATE TRIGGER trg_audit_acteurs_chantier
  BEFORE INSERT OR UPDATE ON acteurs_chantier
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
