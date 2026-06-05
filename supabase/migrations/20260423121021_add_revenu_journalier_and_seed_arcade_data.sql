/*
  # Ajout revenu journalier estime + enrichissement donnees arcade

  1. Modification de la table `equipements`
    - Ajout de `revenu_journalier_estime` (numeric, nullable) : estimation du CA journalier 
      genere par l'equipement, utilise pour calculer la perte financiere en cas de panne

  2. Mise a jour des donnees des bornes arcade
    - Numeros de serie realistes (format fabricant)
    - Revenu journalier estime base sur le type de borne
    - Les dates de mise en service et garantie etaient deja renseignees
*/

-- Ajouter la colonne revenu journalier estime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipements' AND column_name = 'revenu_journalier_estime'
  ) THEN
    ALTER TABLE equipements ADD COLUMN revenu_journalier_estime numeric DEFAULT NULL;

  END IF;

END $$;


-- Enrichir les donnees des bornes arcade existantes
-- FRA-ARCADE-01 : Borne arcade zone 1 (Franconville)
UPDATE equipements SET
  numero_serie = 'SAM-ARK-2024-00147',
  revenu_journalier_estime = 185.00
WHERE code = 'FRA-ARCADE-01';


-- FRA-ARCADE-02 : Borne arcade zone 2 (Franconville)
UPDATE equipements SET
  numero_serie = 'SAM-ARK-2024-00148',
  revenu_journalier_estime = 210.00
WHERE code = 'FRA-ARCADE-02';


-- SGB-ARCADE-01 : Bornes arcade accueil (Sainte-Genevieve-des-Bois)
UPDATE equipements SET
  numero_serie = 'SAM-ARK-2023-00089',
  revenu_journalier_estime = 165.00
WHERE code = 'SGB-ARCADE-01';


-- DOM-ARCADE-01 : Bornes arcade enfants (Rosny Domus)
UPDATE equipements SET
  numero_serie = 'SAM-ARK-2024-00201',
  revenu_journalier_estime = 145.00
WHERE code = 'DOM-ARCADE-01';


-- ALF-ARCADE-01 : Bornes arcade accueil (Alfortville)
UPDATE equipements SET
  numero_serie = 'SAM-ARK-2024-00312',
  revenu_journalier_estime = 195.00
WHERE code = 'ALF-ARCADE-01';

;
