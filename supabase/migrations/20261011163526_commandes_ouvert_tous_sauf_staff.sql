/*
  # Commander : ouvert à tous sauf le staff

  Fin de la phase de test : l'onglet Commander (catalogue, panier, commande
  spécifique, mes commandes) est ouvert à la direction, aux chefs d'équipe,
  directeurs de parc, managers de parc, techniciens et admin IT. Le staff
  opérationnel n'y a pas accès. La gestion du catalogue et le traitement des
  commandes restent réservés au chef d'équipe.
*/

UPDATE public.feature_flags
   SET actif_global = true,
       roles_autorises = ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it']
 WHERE feature_code = 'commandes';
