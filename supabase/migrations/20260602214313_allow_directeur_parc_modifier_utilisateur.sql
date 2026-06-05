/*
  # Lot 1 - Autoriser directeur_parc a modifier les utilisateurs

  ## Description
  Le client demande que la modification d'un utilisateur soit reservee aux roles:
  Direction, Admin IT, Chef maintenance, Directeur de parc.
  La RPC `modifier_utilisateur` actuelle autorise direction, chef_maintenance et admin_it,
  on ajoute directeur_parc a la liste.

  ## Changes
  - Update de la RPC `modifier_utilisateur` pour accepter le role `directeur_parc`
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
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role_code text;

BEGIN
  SELECT r.code INTO v_caller_role_code
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_user_id = auth.uid();


  IF v_caller_role_code IS NULL OR v_caller_role_code NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it') THEN
    RAISE EXCEPTION 'Seule la direction, le chef maintenance, le directeur de parc ou l''admin IT peut modifier un utilisateur' USING ERRCODE = '42501';

  END IF;


  UPDATE utilisateurs
  SET role_id = p_role_id,
      actif = p_actif,
      statut_validation = CASE WHEN p_actif THEN 'valide' ELSE 'desactive' END,
      modifie_le = NOW()
  WHERE id = p_utilisateur_id;


  DELETE FROM parcs_utilisateurs WHERE utilisateur_id = p_utilisateur_id;


  IF array_length(p_parc_ids, 1) > 0 THEN
    INSERT INTO parcs_utilisateurs (utilisateur_id, parc_id, est_manager)
    SELECT p_utilisateur_id, unnest(p_parc_ids), p_est_manager;

  END IF;

END;

$function$;

;
