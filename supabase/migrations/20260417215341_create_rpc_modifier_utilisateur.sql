/*
  # Create RPC modifier_utilisateur

  1. New Function
    - `modifier_utilisateur(p_utilisateur_id, p_role_id, p_parc_ids, p_est_manager, p_actif)`
    - Updates a user's role, active status
    - Replaces all park assignments with the new set
    - Preserves est_manager flag per park assignment

  2. Security
    - SECURITY DEFINER so it bypasses RLS for the multi-table update
    - Only callable by authenticated users (direction role check inside)
    - search_path set to public
*/

CREATE OR REPLACE FUNCTION public.modifier_utilisateur(
  p_utilisateur_id uuid,
  p_role_id uuid,
  p_parc_ids uuid[],
  p_est_manager boolean DEFAULT false,
  p_actif boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role_code text;
BEGIN
  SELECT r.code INTO v_caller_role_code
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();

  IF v_caller_role_code IS NULL OR v_caller_role_code NOT IN ('direction', 'chef_maintenance') THEN
    RAISE EXCEPTION 'Seule la direction ou le chef maintenance peut modifier un utilisateur';
  END IF;

  UPDATE utilisateurs
  SET role_id = p_role_id,
      actif = p_actif,
      statut_validation = CASE WHEN p_actif THEN 'valide' ELSE 'desactive' END,
      modifie_le = NOW()
  WHERE id = p_utilisateur_id;

  DELETE FROM parcs_utilisateurs
  WHERE utilisateur_id = p_utilisateur_id;

  IF array_length(p_parc_ids, 1) > 0 THEN
    INSERT INTO parcs_utilisateurs (utilisateur_id, parc_id, est_manager)
    SELECT p_utilisateur_id, unnest(p_parc_ids), p_est_manager;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.modifier_utilisateur TO authenticated;
