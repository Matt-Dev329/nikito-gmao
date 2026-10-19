-- Import de facture : la facture peut être rattachée à un parc. Les pièces
-- entrent alors dans le stock de ce parc (pièce de même référence du même parc,
-- sinon nouvelle pièce du parc), avec le domaine (activité) de la ligne.
-- Sans parc : stock commun, comme avant.

ALTER TABLE public.factures_stock
  ADD COLUMN IF NOT EXISTS parc_id uuid REFERENCES public.parcs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_factures_stock_parc ON public.factures_stock(parc_id);

CREATE OR REPLACE FUNCTION public.integrer_facture(p_facture_id uuid, p_lignes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_facture record;
  l jsonb;
  v_ordre integer := 0;
  v_ref text;
  v_nom text;
  v_qte numeric;
  v_prix numeric;
  v_activite uuid;
  v_produit uuid;
  v_piece uuid;
  v_stock boolean;
  v_nb_catalogue integer := 0;
  v_nb_stock integer := 0;
BEGIN
  IF NOT peut_entrer_stock() THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_facture FROM factures_stock WHERE id = p_facture_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable';
  END IF;
  IF v_facture.statut = 'integree' THEN
    RAISE EXCEPTION 'Facture déjà intégrée';
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(COALESCE(p_lignes, '[]'::jsonb))
  LOOP
    v_ordre := v_ordre + 1;
    v_nom := NULLIF(trim(l->>'designation'), '');
    CONTINUE WHEN v_nom IS NULL;
    v_ref := NULLIF(trim(l->>'reference'), '');
    v_qte := GREATEST(COALESCE((l->>'quantite')::numeric, 1), 0);
    v_prix := NULLIF(l->>'prix_unitaire_ht', '')::numeric;
    v_activite := NULLIF(l->>'activite_id', '')::uuid;
    v_stock := COALESCE((l->>'ajouter_stock')::boolean, false);
    v_produit := NULL;
    v_piece := NULL;

    -- Catalogue : produit existant (même référence) mis à jour, sinon créé
    IF COALESCE((l->>'ajouter_catalogue')::boolean, true) AND v_activite IS NOT NULL THEN
      IF v_ref IS NOT NULL THEN
        SELECT id INTO v_produit FROM commande_produits
        WHERE lower(reference) = lower(v_ref) ORDER BY actif DESC, cree_le LIMIT 1;
      END IF;
      IF v_produit IS NULL THEN
        INSERT INTO commande_produits (activite_id, nom, reference, prix_unitaire, unite, categorie, sous_categorie, actif)
        VALUES (v_activite, v_nom, v_ref, v_prix, 'unité', NULLIF(trim(l->>'categorie'), ''), NULLIF(trim(l->>'sous_categorie'), ''), true)
        RETURNING id INTO v_produit;
      ELSE
        UPDATE commande_produits
           SET prix_unitaire = COALESCE(v_prix, prix_unitaire),
               categorie = COALESCE(NULLIF(trim(l->>'categorie'), ''), categorie),
               actif = true,
               modifie_le = now()
         WHERE id = v_produit;
      END IF;
      v_nb_catalogue := v_nb_catalogue + 1;
      -- Pièce liée au produit : seulement si elle est dans le stock du même parc
      SELECT p.id INTO v_piece FROM commande_produits c JOIN pieces_detachees p ON p.id = c.piece_id
      WHERE c.id = v_produit AND p.parc_id IS NOT DISTINCT FROM v_facture.parc_id;
    END IF;

    -- Pièce du stock du parc : même référence (ou référence suffixée), sinon créée
    IF v_piece IS NULL AND v_ref IS NOT NULL THEN
      SELECT id INTO v_piece FROM pieces_detachees
      WHERE (reference = v_ref OR reference LIKE v_ref || '-%')
        AND NOT est_formation
        AND parc_id IS NOT DISTINCT FROM v_facture.parc_id
      ORDER BY (reference = v_ref) DESC, cree_le
      LIMIT 1;
    END IF;
    IF v_piece IS NULL AND (v_stock OR v_produit IS NOT NULL) THEN
      INSERT INTO pieces_detachees (reference, nom, stock_actuel, stock_min, prix_unitaire_ht, fournisseur_id, est_formation, parc_id, activite_id)
      VALUES (
        CASE
          WHEN v_ref IS NULL THEN 'FAC-' || left(gen_random_uuid()::text, 8)
          WHEN EXISTS (SELECT 1 FROM pieces_detachees WHERE reference = v_ref) THEN v_ref || '-' || left(gen_random_uuid()::text, 6)
          ELSE v_ref
        END,
        v_nom, 0, 0, v_prix, v_facture.fournisseur_id, false, v_facture.parc_id, v_activite
      )
      RETURNING id INTO v_piece;
    ELSIF v_piece IS NOT NULL THEN
      UPDATE pieces_detachees
         SET prix_unitaire_ht = COALESCE(v_prix, prix_unitaire_ht),
             fournisseur_id = COALESCE(fournisseur_id, v_facture.fournisseur_id),
             activite_id = COALESCE(activite_id, v_activite),
             modifie_le = now()
       WHERE id = v_piece;
    END IF;
    IF v_produit IS NOT NULL AND v_piece IS NOT NULL THEN
      UPDATE commande_produits SET piece_id = v_piece WHERE id = v_produit AND piece_id IS NULL;
    END IF;

    -- Entrée en stock si demandé
    IF v_stock AND v_piece IS NOT NULL AND v_qte > 0 THEN
      UPDATE pieces_detachees SET stock_actuel = stock_actuel + ceil(v_qte)::integer, modifie_le = now() WHERE id = v_piece;
      v_nb_stock := v_nb_stock + 1;
    END IF;

    INSERT INTO factures_stock_lignes (facture_id, ordre, reference, designation, quantite, prix_unitaire_ht, produit_id, piece_id, ajoute_stock)
    VALUES (p_facture_id, v_ordre, v_ref, v_nom, v_qte, v_prix, v_produit, v_piece, v_stock AND v_piece IS NOT NULL);
  END LOOP;

  UPDATE factures_stock SET statut = 'integree', integree_le = now() WHERE id = p_facture_id;
  RETURN jsonb_build_object('catalogue', v_nb_catalogue, 'stock', v_nb_stock);
END;
$function$;
