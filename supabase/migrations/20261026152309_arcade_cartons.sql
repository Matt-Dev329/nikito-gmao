-- Arcade : les consommables se commandent au carton, pas à l'unité.
UPDATE public.commande_produits p
SET unite = 'carton'
FROM public.commande_activites a
WHERE a.id = p.activite_id
  AND a.nom ILIKE '%arcade%'
  AND p.unite = 'unité';
