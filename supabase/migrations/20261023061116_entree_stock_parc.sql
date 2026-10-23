-- Entrée de stock dans le parc choisi (vide = stock commun). Si la pièce
-- appartient à un autre parc, l'entrée va sur la pièce de même référence de ce
-- parc, créée au besoin (mêmes nom, fournisseur, prix, domaine). Réservé à ceux
-- qui peuvent entrer du stock (chef d'équipe, direction, admin IT).

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
  IF NOT peut_entrer_stock() THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut ajouter du stock' USING ERRCODE = '42501';
  END IF;
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

REVOKE ALL ON FUNCTION public.entree_stock_parc(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entree_stock_parc(uuid, uuid, integer) TO authenticated;
