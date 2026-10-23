-- Les techniciens Arcade (Lili-Marie, Joachim) gèrent le stock Arcade :
-- création de pièces, entrées, sorties et rangement, uniquement pour les
-- pièces du domaine « Arcade ». Le reste du stock reste réservé au chef
-- d'équipe, à la direction et à l'admin IT (accord de Ryad, 23/10).

CREATE OR REPLACE FUNCTION public.peut_gerer_piece(p_activite_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT peut_entrer_stock()
      OR (current_role_code()::text = 'technicien'
          AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = current_utilisateur_id() AND profil_technicien = 'arcade')
          AND p_activite_id IS NOT NULL
          AND p_activite_id = (SELECT id FROM commande_activites WHERE nom = 'Arcade' LIMIT 1));
$function$;
REVOKE ALL ON FUNCTION public.peut_gerer_piece(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_gerer_piece(uuid) TO authenticated;

ALTER POLICY pieces_ecriture_gestionnaires ON public.pieces_detachees
  USING (peut_gerer_piece(activite_id))
  WITH CHECK (peut_gerer_piece(activite_id));

CREATE OR REPLACE FUNCTION public.mouvement_stock(p_piece_id uuid, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stock integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_delta > 0 AND NOT peut_gerer_piece((SELECT activite_id FROM pieces_detachees WHERE id = p_piece_id)) THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut ajouter du stock' USING ERRCODE = '42501';
  END IF;
  UPDATE pieces_detachees
     SET stock_actuel = GREATEST(0, stock_actuel + p_delta), modifie_le = now()
   WHERE id = p_piece_id
  RETURNING stock_actuel INTO v_stock;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pièce introuvable';
  END IF;
  RETURN v_stock;
END;
$function$;

CREATE OR REPLACE FUNCTION public.entree_stock_parc(p_piece_id uuid, p_parc_id uuid, p_quantite integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_source pieces_detachees%ROWTYPE;
  v_cible uuid;
  v_ref text;
  v_stock integer;
BEGIN
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF p_parc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parcs WHERE id = p_parc_id) THEN
    RAISE EXCEPTION 'Parc introuvable';
  END IF;

  SELECT * INTO v_source FROM pieces_detachees WHERE id = p_piece_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pièce introuvable';
  END IF;
  IF NOT peut_gerer_piece(v_source.activite_id) THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut ajouter du stock' USING ERRCODE = '42501';
  END IF;

  IF v_source.parc_id IS NOT DISTINCT FROM p_parc_id THEN
    v_cible := v_source.id;
  ELSE
    -- Même pièce dans le parc choisi (même référence, éventuellement suffixée)
    v_ref := regexp_replace(v_source.reference, '-[0-9a-f]{6}$', '');
    SELECT id INTO v_cible FROM pieces_detachees
    WHERE parc_id IS NOT DISTINCT FROM p_parc_id
      AND est_formation = v_source.est_formation
      AND (reference = v_ref OR reference LIKE v_ref || '-%')
    ORDER BY (reference = v_ref) DESC, cree_le
    LIMIT 1;
    IF v_cible IS NULL THEN
      INSERT INTO pieces_detachees (reference, nom, description, fournisseur_id, stock_actuel, stock_min,
                                    prix_unitaire_ht, delai_reappro_jours, est_formation, parc_id, activite_id)
      VALUES (
        CASE WHEN EXISTS (SELECT 1 FROM pieces_detachees WHERE reference = v_ref)
             THEN v_ref || '-' || left(gen_random_uuid()::text, 6) ELSE v_ref END,
        v_source.nom, v_source.description, v_source.fournisseur_id, 0, v_source.stock_min,
        v_source.prix_unitaire_ht, v_source.delai_reappro_jours, v_source.est_formation, p_parc_id, v_source.activite_id)
      RETURNING id INTO v_cible;
    END IF;
  END IF;

  UPDATE pieces_detachees
     SET stock_actuel = stock_actuel + p_quantite, modifie_le = now()
   WHERE id = v_cible
  RETURNING stock_actuel INTO v_stock;

  RETURN jsonb_build_object(
    'piece_id', v_cible,
    'stock', v_stock,
    'parc', coalesce((SELECT code FROM parcs WHERE id = p_parc_id), 'stock commun'));
END;
$function$;
