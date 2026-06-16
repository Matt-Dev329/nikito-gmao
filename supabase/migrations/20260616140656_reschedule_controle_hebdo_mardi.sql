/*
  # Génération du contrôle hebdomadaire : lundi -> mardi

  Le client souhaite que le contrôle hebdo soit généré chaque MARDI (et non lundi).
  On reprogramme le job pg_cron `gmao_genere_hebdo` (cron.schedule met à jour le
  job existant, upsert par nom). Aucune autre logique modifiée.

  Cron : `15 4 * * 2` = tous les mardis à 04h15.
*/
SELECT cron.schedule(
  'gmao_genere_hebdo',
  '15 4 * * 2',
  $$SELECT generer_tous_controles_hebdo(CURRENT_DATE)$$
);
