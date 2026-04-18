/*
  # Seed demo data for Fleet module

  1. Data inserted
    - 3 demo vehicles (Kangoo, Berlingo, 3008)
    - Initial GPS positions for each vehicle
      - VEH-01: Stationed at Alfortville park
      - VEH-02: Moving on A86 towards Rosny
      - VEH-03: Stationed at Franconville park
*/

INSERT INTO vehicules (code, libelle, immatriculation, marque, modele, statut, km_actuel, date_derniere_revision, date_prochaine_revision)
VALUES
  ('VEH-01', 'Utilitaire Maintenance 1', 'AB-123-CD', 'Renault', 'Kangoo', 'actif', 42350, '2026-01-15', '2026-07-15'),
  ('VEH-02', 'Utilitaire Maintenance 2', 'EF-456-GH', 'Citroen', 'Berlingo', 'actif', 28100, '2026-02-20', '2026-08-20'),
  ('VEH-03', 'Vehicule Direction', 'IJ-789-KL', 'Peugeot', '3008', 'actif', 15700, '2026-03-10', '2026-09-10')
ON CONFLICT DO NOTHING;

INSERT INTO vehicules_positions (vehicule_id, latitude, longitude, vitesse, moteur_allume, batterie_tracker, adresse)
VALUES
  ((SELECT id FROM vehicules WHERE code = 'VEH-01'), 48.8049, 2.4212, 0, false, 85, 'Nikito Alfortville - stationne'),
  ((SELECT id FROM vehicules WHERE code = 'VEH-02'), 48.8709, 2.4866, 35, true, 72, 'A86 direction Rosny-sous-Bois'),
  ((SELECT id FROM vehicules WHERE code = 'VEH-03'), 48.9892, 2.2288, 0, false, 91, 'Nikito Franconville - stationne');
