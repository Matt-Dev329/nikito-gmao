/*
  # Catalogue commandes : gestion réservée au rôle Chef d'équipe

  - Nouvelle fonction `peut_gerer_catalogue_commandes()` : vrai si le rôle
    courant est `chef_maintenance` (libellé « Chef d'équipe » dans l'UI).
  - Les policies d'écriture (INSERT/UPDATE/DELETE) de `commande_activites` et
    `commande_produits` passent du gestionnaire des commandes à ce rôle
    (modifiées en place via ALTER POLICY, puis renommées).
  - La lecture du catalogue reste ouverte à qui peut commander, plus aux
    chefs d'équipe (pour qu'ils puissent le gérer).
  - La réception / le traitement des commandes ne change pas (gestionnaire).
*/

CREATE OR REPLACE FUNCTION public.peut_gerer_catalogue_commandes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT COALESCE(current_role_code()::text = 'chef_maintenance', false);
$$;

REVOKE EXECUTE ON FUNCTION public.peut_gerer_catalogue_commandes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_gerer_catalogue_commandes() TO authenticated;

-- Activités
ALTER POLICY "Lecture activités si accès commandes" ON public.commande_activites
  USING ((SELECT peut_commander()) OR (SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires créent les activités" ON public.commande_activites
  WITH CHECK ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires modifient les activités" ON public.commande_activites
  USING ((SELECT peut_gerer_catalogue_commandes()))
  WITH CHECK ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires suppriment les activités" ON public.commande_activites
  USING ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires créent les activités" ON public.commande_activites RENAME TO "Chefs d'équipe créent les activités";
ALTER POLICY "Gestionnaires modifient les activités" ON public.commande_activites RENAME TO "Chefs d'équipe modifient les activités";
ALTER POLICY "Gestionnaires suppriment les activités" ON public.commande_activites RENAME TO "Chefs d'équipe suppriment les activités";

-- Produits
ALTER POLICY "Lecture produits si accès commandes" ON public.commande_produits
  USING ((SELECT peut_commander()) OR (SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires créent les produits" ON public.commande_produits
  WITH CHECK ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires modifient les produits" ON public.commande_produits
  USING ((SELECT peut_gerer_catalogue_commandes()))
  WITH CHECK ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires suppriment les produits" ON public.commande_produits
  USING ((SELECT peut_gerer_catalogue_commandes()));
ALTER POLICY "Gestionnaires créent les produits" ON public.commande_produits RENAME TO "Chefs d'équipe créent les produits";
ALTER POLICY "Gestionnaires modifient les produits" ON public.commande_produits RENAME TO "Chefs d'équipe modifient les produits";
ALTER POLICY "Gestionnaires suppriment les produits" ON public.commande_produits RENAME TO "Chefs d'équipe suppriment les produits";
