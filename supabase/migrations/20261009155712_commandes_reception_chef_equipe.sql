/*
  # Commandes : réception et traitement réservés au rôle Chef d'équipe

  `est_gestionnaire_commandes()` ne repose plus sur la table
  `commandes_gestionnaires` mais sur le rôle courant `chef_maintenance`
  (« Chef d'équipe »). Toutes les règles qui l'utilisent suivent donc :
  voir toutes les commandes et leurs lignes, les valider / refuser /
  marquer commandées et livrées, badge « Commandes à traiter ».
  Les emails de nouvelle commande vont aux chefs d'équipe actifs
  (edge function notifier-commande).
*/

CREATE OR REPLACE FUNCTION public.est_gestionnaire_commandes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT COALESCE(current_role_code()::text = 'chef_maintenance', false);
$$;
