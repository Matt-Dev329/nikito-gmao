-- Catalogue de commandes : visibilité par parc. Une activité ou un produit
-- peut être réservé à certains parcs (parc_ids) ; liste vide = tous les parcs.
-- Le chef d'équipe (gestion du catalogue) voit tout ; les autres ne voient que
-- ce qui est ouvert à l'un de leurs parcs (et, pour un produit, son activité).

ALTER TABLE public.commande_activites
  ADD COLUMN IF NOT EXISTS parc_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.commande_produits
  ADD COLUMN IF NOT EXISTS parc_ids uuid[] NOT NULL DEFAULT '{}';

ALTER POLICY "Lecture activités si accès commandes" ON public.commande_activites
  USING (
    (SELECT peut_gerer_catalogue_commandes())
    OR ((SELECT peut_commander()) AND (cardinality(parc_ids) = 0 OR parc_ids && current_parc_ids()))
  );

ALTER POLICY "Lecture produits si accès commandes" ON public.commande_produits
  USING (
    (SELECT peut_gerer_catalogue_commandes())
    OR (
      (SELECT peut_commander())
      AND (cardinality(parc_ids) = 0 OR parc_ids && current_parc_ids())
      AND EXISTS (
        SELECT 1 FROM commande_activites a
        WHERE a.id = commande_produits.activite_id
          AND (cardinality(a.parc_ids) = 0 OR a.parc_ids && current_parc_ids())
      )
    )
  );
