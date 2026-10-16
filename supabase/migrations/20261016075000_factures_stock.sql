/*
  # Import de factures dans le stock et le catalogue

  1. Bucket privé `alba-factures` (PDF / photos de factures, 25 Mo) —
     lecture et dépôt réservés aux rôles qui peuvent faire des entrées de
     stock (peut_entrer_stock : chef d'équipe, direction, admin IT,
     gestionnaires des commandes).
  2. Tables `factures_stock` et `factures_stock_lignes`.
     La fonction Edge `extraire-facture` lit la facture (Claude) et
     enregistre les lignes proposées (statut 'a_valider').
  3. RPC `integrer_facture(p_facture_id, p_lignes)` : après relecture,
     chaque ligne est ajoutée / mise à jour au catalogue des commandes
     (activité, catégorie, prix), liée à une pièce du stock (créée au
     besoin, prix mis à jour) et, si demandé, entrée en stock.
  Script rejouable.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('alba-factures', 'alba-factures', false, 26214400,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "alba_factures_lecture" ON storage.objects;
CREATE POLICY "alba_factures_lecture" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'alba-factures' AND (SELECT peut_entrer_stock()));

DROP POLICY IF EXISTS "alba_factures_ajout" ON storage.objects;
CREATE POLICY "alba_factures_ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'alba-factures' AND (SELECT peut_entrer_stock()));

CREATE TABLE IF NOT EXISTS public.factures_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fichier text NOT NULL,
  mime text,
  taille integer,
  statut text NOT NULL DEFAULT 'analyse' CHECK (statut IN ('analyse', 'a_valider', 'integree', 'echec', 'abandonnee')),
  fournisseur_nom text,
  fournisseur_id uuid REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  numero text,
  date_facture date,
  total_ht numeric(12, 2),
  total_ttc numeric(12, 2),
  erreur text,
  cree_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  integree_le timestamptz
);
CREATE INDEX IF NOT EXISTS idx_factures_stock_cree_le ON public.factures_stock(cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_factures_stock_cree_par ON public.factures_stock(cree_par_id);
CREATE INDEX IF NOT EXISTS idx_factures_stock_fournisseur ON public.factures_stock(fournisseur_id);

CREATE TABLE IF NOT EXISTS public.factures_stock_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures_stock(id) ON DELETE CASCADE,
  ordre integer NOT NULL DEFAULT 0,
  reference text,
  designation text NOT NULL,
  quantite numeric(12, 2) NOT NULL DEFAULT 1,
  prix_unitaire_ht numeric(12, 2),
  produit_id uuid REFERENCES public.commande_produits(id) ON DELETE SET NULL,
  piece_id uuid REFERENCES public.pieces_detachees(id) ON DELETE SET NULL,
  ajoute_stock boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_factures_lignes_facture ON public.factures_stock_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_factures_lignes_produit ON public.factures_stock_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_factures_lignes_piece ON public.factures_stock_lignes(piece_id);

ALTER TABLE public.factures_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_stock_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS factures_stock_lecture ON public.factures_stock;
CREATE POLICY factures_stock_lecture ON public.factures_stock FOR SELECT TO authenticated
USING ((SELECT peut_entrer_stock()));
DROP POLICY IF EXISTS factures_stock_ajout ON public.factures_stock;
CREATE POLICY factures_stock_ajout ON public.factures_stock FOR INSERT TO authenticated
WITH CHECK ((SELECT peut_entrer_stock()) AND cree_par_id = (SELECT current_utilisateur_id()));
DROP POLICY IF EXISTS factures_stock_modification ON public.factures_stock;
CREATE POLICY factures_stock_modification ON public.factures_stock FOR UPDATE TO authenticated
USING ((SELECT peut_entrer_stock())) WITH CHECK ((SELECT peut_entrer_stock()));

DROP POLICY IF EXISTS factures_lignes_lecture ON public.factures_stock_lignes;
CREATE POLICY factures_lignes_lecture ON public.factures_stock_lignes FOR SELECT TO authenticated
USING ((SELECT peut_entrer_stock()));

-- Intégration d'une facture relue : catalogue, pièce du stock, entrée en stock
CREATE OR REPLACE FUNCTION public.integrer_facture(p_facture_id uuid, p_lignes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
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

  DELETE FROM factures_stock_lignes WHERE facture_id = p_facture_id;

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
      SELECT piece_id INTO v_piece FROM commande_produits WHERE id = v_produit;
    END IF;

    -- Pièce du stock : liée au produit, ou même référence, sinon créée
    IF v_piece IS NULL AND v_ref IS NOT NULL THEN
      SELECT id INTO v_piece FROM pieces_detachees WHERE reference = v_ref AND NOT est_formation;
    END IF;
    IF v_piece IS NULL AND (v_stock OR v_produit IS NOT NULL) THEN
      INSERT INTO pieces_detachees (reference, nom, stock_actuel, stock_min, prix_unitaire_ht, fournisseur_id, est_formation)
      VALUES (
        CASE
          WHEN v_ref IS NULL THEN 'FAC-' || left(gen_random_uuid()::text, 8)
          WHEN EXISTS (SELECT 1 FROM pieces_detachees WHERE reference = v_ref) THEN v_ref || '-' || left(gen_random_uuid()::text, 6)
          ELSE v_ref
        END,
        v_nom, 0, 0, v_prix, v_facture.fournisseur_id, false
      )
      RETURNING id INTO v_piece;
    ELSIF v_piece IS NOT NULL THEN
      UPDATE pieces_detachees
         SET prix_unitaire_ht = COALESCE(v_prix, prix_unitaire_ht),
             fournisseur_id = COALESCE(fournisseur_id, v_facture.fournisseur_id),
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
$$;
REVOKE EXECUTE ON FUNCTION public.integrer_facture(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integrer_facture(uuid, jsonb) TO authenticated;

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016075000', 'factures_stock')
ON CONFLICT (version) DO NOTHING;
