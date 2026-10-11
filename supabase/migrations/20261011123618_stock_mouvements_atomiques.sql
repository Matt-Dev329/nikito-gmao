/*
  # Stock : mouvements atomiques et plancher à 0

  1. RPC `mouvement_stock(p_piece_id, p_delta)` (SECURITY INVOKER : la RLS
     d'écriture de pieces_detachees s'applique) : applique le mouvement en
     une seule requête, sans lire puis réécrire la valeur (évite d'écraser une
     livraison ou une clôture d'intervention simultanée). Erreur explicite si
     aucune ligne n'est modifiée (droits insuffisants ou pièce introuvable).
  2. `decrement_stock` (pièces utilisées en intervention) ne descend plus
     sous 0, comme la sortie manuelle.
  3. Commande spécifique validée : si l'article existe déjà mais est masqué
     dans le catalogue, il est réactivé (sinon il restait impossible à
     recommander alors que le message annonçait son ajout).
*/

CREATE OR REPLACE FUNCTION public.mouvement_stock(p_piece_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_stock integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  UPDATE pieces_detachees
     SET stock_actuel = GREATEST(0, stock_actuel + p_delta), modifie_le = now()
   WHERE id = p_piece_id
  RETURNING stock_actuel INTO v_stock;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mouvement refusé : pièce introuvable ou droits insuffisants';
  END IF;
  RETURN v_stock;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mouvement_stock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mouvement_stock(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE pieces_detachees SET stock_actuel = GREATEST(0, stock_actuel - NEW.quantite), modifie_le = NOW()
  WHERE id = NEW.piece_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_commande_validee_ajout_catalogue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  l record;
  v_produit_id uuid;
BEGIN
  IF NEW.statut <> 'validee' OR OLD.statut <> 'demandee' THEN
    RETURN NEW;
  END IF;

  FOR l IN
    SELECT * FROM commande_lignes
    WHERE commande_id = NEW.id AND specifique AND produit_id IS NULL AND activite_id IS NOT NULL
  LOOP
    SELECT id INTO v_produit_id FROM commande_produits
    WHERE activite_id = l.activite_id
      AND ((l.reference IS NOT NULL AND reference = l.reference) OR lower(nom) = lower(l.produit_nom))
    ORDER BY (reference = l.reference) DESC NULLS LAST, actif DESC
    LIMIT 1;

    IF v_produit_id IS NULL THEN
      INSERT INTO commande_produits (activite_id, nom, reference, unite, description, categorie, ordre)
      VALUES (l.activite_id, l.produit_nom, l.reference, l.unite,
              'Ajouté depuis la commande spécifique ' || NEW.numero || COALESCE(' · Lien : ' || l.lien, ''),
              'Commandes spécifiques',
              (SELECT COALESCE(max(ordre), 0) + 1 FROM commande_produits WHERE activite_id = l.activite_id))
      RETURNING id INTO v_produit_id;
    ELSE
      UPDATE commande_produits SET actif = true, modifie_le = now() WHERE id = v_produit_id AND NOT actif;
    END IF;

    UPDATE commande_lignes SET produit_id = v_produit_id WHERE id = l.id;
  END LOOP;

  RETURN NEW;
END;
$$;
