/*
  # Seed donnees initiales - Module Conformite ERP

  Initialise la phase actuelle pour chaque parc existant :
  - ALF (Nikito Alfortville) : ouvert, en vie_courante
  - DOM (Nikito Rosny Domus) : ouvert, en vie_courante
  - FRA (Nikito Franconville) : ouvert, en vie_courante
  - SGB (Nikito Sainte-Genevieve-des-Bois) : ouvert, en vie_courante

  Les 4 parcs sont actuellement en exploitation. On cree la phase vie_courante
  pour chacun avec une date_debut correspondant a leur mise en service approximative.
*/

-- ALF - Nikito Alfortville (ouvert depuis environ 2023)
INSERT INTO parcs_phases (parc_id, phase, date_debut, notes)
SELECT '7b5f4ba4-3435-4e62-972a-148739e8585f', 'vie_courante', '2023-01-15T00:00:00Z', 'Phase initiale - parc en exploitation'
WHERE NOT EXISTS (
  SELECT 1 FROM parcs_phases WHERE parc_id = '7b5f4ba4-3435-4e62-972a-148739e8585f'
);

-- DOM - Nikito Rosny Domus (ouvert depuis environ 2022)
INSERT INTO parcs_phases (parc_id, phase, date_debut, notes)
SELECT 'cfd13e83-aa27-450b-93e1-d631b1dbe306', 'vie_courante', '2022-06-01T00:00:00Z', 'Phase initiale - parc en exploitation'
WHERE NOT EXISTS (
  SELECT 1 FROM parcs_phases WHERE parc_id = 'cfd13e83-aa27-450b-93e1-d631b1dbe306'
);

-- FRA - Nikito Franconville (ouvert depuis environ 2024)
INSERT INTO parcs_phases (parc_id, phase, date_debut, notes)
SELECT '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'vie_courante', '2024-03-01T00:00:00Z', 'Phase initiale - parc en exploitation'
WHERE NOT EXISTS (
  SELECT 1 FROM parcs_phases WHERE parc_id = '9fefd3d6-4a42-46fb-a09e-2f3b670628a4'
);

-- SGB - Nikito Sainte-Genevieve-des-Bois (ouvert depuis environ 2024)
INSERT INTO parcs_phases (parc_id, phase, date_debut, notes)
SELECT '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'vie_courante', '2024-09-01T00:00:00Z', 'Phase initiale - parc en exploitation'
WHERE NOT EXISTS (
  SELECT 1 FROM parcs_phases WHERE parc_id = '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f'
);
