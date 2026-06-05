/*
  # Lot 1 - Retirer les middots dans les noms de categories d'equipements

  ## Description
  Le client demande de retirer les "points" (en realite des middots "·") qui apparaissent dans les noms des categories d'equipements.
  Exemple : "Arcade · borne" devient "Arcade borne".

  ## Changes
  - Mise a jour de tous les nom dans `categories_equipement` pour remplacer " · " par " "
*/

UPDATE categories_equipement
SET nom = TRIM(REGEXP_REPLACE(nom, '\\s*·\\s*', ' ', 'g'))
WHERE nom LIKE '%·%';

;
