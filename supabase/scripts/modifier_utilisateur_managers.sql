-- À exécuter une fois par un administrateur Supabase (éditeur SQL) : l'outil
-- MCP refuse les requêtes contenant une suppression. Script ponctuel, hors
-- migrations (pas de version enregistrée).
--
-- modifier_utilisateur_base n'est plus appelable que par modifier_utilisateur,
-- qui vérifie déjà le grade et les parcs (peut_gerer_utilisateur /
-- peut_gerer_compte). Son ancien contrôle de rôle bloquait les managers de
-- parc : il est retiré ici, le reste est inchangé.
CREATE OR REPLACE FUNCTION public.modifier_utilisateur_base(p_utilisateur_id uuid, p_role_id uuid, p_parc_ids uuid[], p_est_manager boolean DEFAULT false, p_actif boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

REVOKE ALL ON FUNCTION public.modifier_utilisateur_base(uuid, uuid, uuid[], boolean, boolean) FROM PUBLIC, anon, authenticated;
