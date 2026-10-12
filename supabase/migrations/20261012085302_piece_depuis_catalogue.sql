/*
  # Pièces utilisées choisies dans le catalogue (activité › catégorie)

  RPC `piece_depuis_catalogue(p_produit_id)` : renvoie la pièce du stock
  correspondant à un produit du catalogue commandes, en la créant au besoin
  (stock 0, seuil 0 pour ne pas déclencher d'alerte de réappro) et en
  liant le produit (`commande_produits.piece_id`). Permet d'enregistrer
  une pièce utilisée même si elle n'a jamais été entrée en stock.
*/

CREATE OR REPLACE FUNCTION public.piece_depuis_catalogue(p_produit_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_produit record;
  v_piece_id uuid;
  v_reference text;
BEGIN
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.nom, p.reference, p.piece_id, p.categorie, p.sous_categorie, a.nom AS activite
    INTO v_produit
  FROM commande_produits p JOIN commande_activites a ON a.id = p.activite_id
  WHERE p.id = p_produit_id
  FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable dans le catalogue';
  END IF;

  IF v_produit.piece_id IS NOT NULL THEN
    RETURN v_produit.piece_id;
  END IF;

  v_reference := COALESCE(NULLIF(trim(v_produit.reference), ''), 'CAT-' || left(p_produit_id::text, 8));

  SELECT id INTO v_piece_id FROM pieces_detachees
  WHERE reference = v_reference AND NOT est_formation;

  IF v_piece_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM pieces_detachees WHERE reference = v_reference) THEN
      v_reference := v_reference || '-' || left(p_produit_id::text, 6);
    END IF;
    INSERT INTO pieces_detachees (reference, nom, description, stock_actuel, stock_min, est_formation)
    VALUES (
      v_reference,
      v_produit.nom,
      concat_ws(' · ', v_produit.activite, v_produit.categorie, v_produit.sous_categorie),
      0, 0, false
    )
    RETURNING id INTO v_piece_id;
  END IF;

  UPDATE commande_produits SET piece_id = v_piece_id WHERE id = p_produit_id;
  RETURN v_piece_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.piece_depuis_catalogue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.piece_depuis_catalogue(uuid) TO authenticated;
