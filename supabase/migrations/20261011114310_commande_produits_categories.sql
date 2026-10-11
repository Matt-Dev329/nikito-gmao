/*
  # Catalogue commandes : catégories de produits

  Ajoute deux niveaux de classement facultatifs aux produits, à l'intérieur
  d'une activité (ex. Bowling > Requilleuse EDGE String > Élévateur à chaîne),
  utilisés comme filtres dans l'onglet Commander.
*/
ALTER TABLE public.commande_produits ADD COLUMN IF NOT EXISTS categorie text;
ALTER TABLE public.commande_produits ADD COLUMN IF NOT EXISTS sous_categorie text;
CREATE INDEX IF NOT EXISTS idx_commande_produits_categorie ON public.commande_produits(activite_id, categorie);
