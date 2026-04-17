/*
  # Seed plaintes clients, certifications, maintenances preventives et pieces detachees formation

  1. Plaintes clients (15 plaintes sur 12 mois)
    - Reparties sur 4 parcs, canaux varies
    - Certaines liees a des incidents existants

  2. Certifications (20 certifications sur les equipements)
    - Normes reelles : NF EN 14960, NF EN 1176, NF EN 13814
    - Echeances variees (certaines expirees, a venir, en cours)

  3. Maintenances preventives (12 taches)
    - Frequences variees : 30, 90, 180, 365 jours
    - Liees aux equipements de formation

  4. Pieces detachees (15 pieces)
    - Certaines sous le seuil minimum pour tester les alertes stock
*/

-- PLAINTES CLIENTS
INSERT INTO plaintes_clients (parc_id, equipement_id, declare_le, canal, commentaire, est_formation) VALUES
('9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'a0000001-0001-0001-0001-000000000002', CURRENT_TIMESTAMP - INTERVAL '3 days', 'google_review', 'Trampoline en mauvais etat, mousses dechirees. Decevant pour le prix.', true),
('9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'a0000001-0001-0001-0001-000000000009', CURRENT_TIMESTAMP - INTERVAL '12 days', 'caisse', 'Mon fils na pas pu jouer au laser game, 3 gilets sur 20 ne marchaient pas.', true),
('9fefd3d6-4a42-46fb-a09e-2f3b670628a4', NULL, CURRENT_TIMESTAMP - INTERVAL '25 days', 'google_review', 'Tres bien mais les toilettes sont sales. Dommage.', true),
('9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'a0000001-0001-0001-0001-000000000007', CURRENT_TIMESTAMP - INTERVAL '60 days', 'email', 'La borne darcade a avale mon jeton sans lancer le jeu.', true),
('6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'a0000001-0002-0001-0001-000000000003', CURRENT_TIMESTAMP - INTERVAL '8 days', 'google_review', 'Piste de bowling glissante de maniere irreguliere. Pas agreable.', true),
('6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'a0000001-0002-0001-0001-000000000005', CURRENT_TIMESTAMP - INTERVAL '30 days', 'caisse', 'Le kart de mon enfant sest arrete en pleine course. Tres dangereux!', true),
('6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', NULL, CURRENT_TIMESTAMP - INTERVAL '90 days', 'tel', 'Anniversaire rate, la salle etait pas prete a lheure. Remboursement demande.', true),
('cfd13e83-aa27-450b-93e1-d631b1dbe306', 'a0000001-0003-0001-0001-000000000003', CURRENT_TIMESTAMP - INTERVAL '5 days', 'google_review', 'Le chateau gonflable etait degonfle quand on est arrives. Enfants decus.', true),
('cfd13e83-aa27-450b-93e1-d631b1dbe306', 'a0000001-0003-0001-0001-000000000004', CURRENT_TIMESTAMP - INTERVAL '45 days', 'email', 'Zone octogone fermee sans prevenir. On avait reserve pour ca.', true),
('cfd13e83-aa27-450b-93e1-d631b1dbe306', NULL, CURRENT_TIMESTAMP - INTERVAL '120 days', 'google_review', 'Super parc mais manque de proprete dans les vestiaires.', true),
('7b5f4ba4-3435-4e62-972a-148739e8585f', 'a0000001-0004-0001-0001-000000000004', CURRENT_TIMESTAMP - INTERVAL '7 days', 'caisse', 'Laser game: la moitie des gilets ne detectent pas les tirs.', true),
('7b5f4ba4-3435-4e62-972a-148739e8585f', 'a0000001-0004-0001-0001-000000000001', CURRENT_TIMESTAMP - INTERVAL '20 days', 'google_review', 'Trampoline ferme pour reparation pendant notre visite. Pas indique sur le site.', true),
('7b5f4ba4-3435-4e62-972a-148739e8585f', NULL, CURRENT_TIMESTAMP - INTERVAL '75 days', 'tel', 'Climatisation en panne, il faisait trop chaud pour les enfants.', true),
('9fefd3d6-4a42-46fb-a09e-2f3b670628a4', NULL, CURRENT_TIMESTAMP - INTERVAL '150 days', 'app_client', 'Application client bugguee, impossible de reserver un creneau bowling.', true),
('6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', NULL, CURRENT_TIMESTAMP - INTERVAL '200 days', 'google_review', 'Tres bon parc, mais les casiers sont souvent en panne.', true);

-- CERTIFICATIONS
INSERT INTO certifications (equipement_id, norme, organisme_certificateur, numero_certificat, date_certif, prochaine_echeance, notes) VALUES
-- Trampolines (NF EN 13814 - Attractions foraines)
('a0000001-0001-0001-0001-000000000001', 'NF EN 13814', 'Bureau Veritas', 'BV-2024-FRA-001', '2024-06-15', '2025-06-15', 'Controle annuel structure metallique et ressorts'),
('a0000001-0001-0001-0001-000000000002', 'NF EN 13814', 'Bureau Veritas', 'BV-2024-FRA-002', '2024-06-15', '2025-06-15', 'Trampoline a surveiller - usure prematuree'),
('a0000001-0001-0001-0001-000000000003', 'NF EN 13814', 'Bureau Veritas', 'BV-2024-FRA-003', '2024-09-01', '2025-09-01', NULL),
('a0000001-0002-0001-0001-000000000001', 'NF EN 13814', 'Apave', 'APV-2024-SGB-001', '2024-05-10', '2025-05-10', 'Certification a renouveler prochainement'),
('a0000001-0002-0001-0001-000000000002', 'NF EN 13814', 'Apave', 'APV-2024-SGB-002', '2024-05-10', '2025-05-10', NULL),
('a0000001-0003-0001-0001-000000000001', 'NF EN 13814', 'Socotec', 'SOC-2025-DOM-001', '2025-01-20', '2026-01-20', NULL),
('a0000001-0003-0001-0001-000000000002', 'NF EN 13814', 'Socotec', 'SOC-2025-DOM-002', '2025-01-20', '2026-01-20', NULL),
('a0000001-0004-0001-0001-000000000001', 'NF EN 13814', 'Bureau Veritas', 'BV-2025-ALF-001', '2025-03-01', '2026-03-01', NULL),
-- Gonflables (NF EN 14960)
('a0000001-0003-0001-0001-000000000003', 'NF EN 14960', 'Socotec', 'SOC-2025-DOM-G01', '2025-02-15', '2026-02-15', 'Structure gonflable geante - controle annuel'),
('a0000001-0004-0001-0001-000000000008', 'NF EN 14960', 'Bureau Veritas', 'BV-2025-ALF-G01', '2025-04-01', '2026-04-01', NULL),
-- SoftPlay (NF EN 1176)
('a0000001-0001-0001-0001-000000000005', 'NF EN 1176', 'Dekra', 'DK-2024-FRA-SP1', '2024-08-20', '2025-08-20', 'Inspection aires de jeux'),
('a0000001-0004-0001-0001-000000000003', 'NF EN 1176', 'Dekra', 'DK-2025-ALF-SP1', '2025-02-10', '2026-02-10', NULL),
-- Securite (ERP)
('a0000001-0001-0001-0001-000000000006', 'Arrete du 25 juin 1980 (ERP)', 'Commission securite', 'CS-2024-FRA-01', '2024-11-15', '2025-11-15', 'Visite commission securite annuelle'),
('a0000001-0002-0001-0001-000000000006', 'Arrete du 25 juin 1980 (ERP)', 'Commission securite', 'CS-2024-SGB-01', '2024-10-20', '2025-10-20', NULL),
('a0000001-0003-0001-0001-000000000005', 'Arrete du 25 juin 1980 (ERP)', 'Commission securite', 'CS-2025-DOM-01', '2025-03-10', '2026-03-10', NULL),
('a0000001-0004-0001-0001-000000000005', 'Arrete du 25 juin 1980 (ERP)', 'Commission securite', 'CS-2025-ALF-01', '2025-01-25', '2026-01-25', NULL),
-- Karting (NF EN 13814 specifique)
('a0000001-0002-0001-0001-000000000005', 'NF EN 13814 + NF C 15-100', 'Apave', 'APV-2024-SGB-K01', '2024-07-01', '2025-07-01', 'Controle electrique + structure circuit'),
-- Bowling (normes equipements)
('a0000001-0002-0001-0001-000000000003', 'NF EN 13814', 'Socotec', 'SOC-2024-SGB-B01', '2024-04-15', '2025-04-15', 'Certification expiree - a renouveler!'),
('a0000001-0002-0001-0001-000000000004', 'NF EN 13814', 'Socotec', 'SOC-2024-SGB-B02', '2024-04-15', '2025-04-15', 'Certification expiree - a renouveler!'),
-- Laser Game
('a0000001-0001-0001-0001-000000000009', 'NF EN 60825-1 (securite laser)', 'Bureau Veritas', 'BV-2025-FRA-LG1', '2025-02-01', '2026-02-01', 'Controle securite laser classe 1');

-- MAINTENANCES PREVENTIVES
INSERT INTO maintenances_preventives (equipement_id, type, libelle, description, frequence_jours, derniere_execution, prochaine_echeance, duree_min_estimee, actif) VALUES
('a0000001-0001-0001-0001-000000000001', 'preventif_systematique'::type_maintenance, 'Verification ressorts trampoline A', 'Verifier tension et integrite de tous les ressorts, remplacer si deformes', 90, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '45 days', 120, true),
('a0000001-0001-0001-0001-000000000002', 'preventif_systematique'::type_maintenance, 'Verification ressorts trampoline B', 'Verifier tension et integrite de tous les ressorts', 90, CURRENT_DATE - INTERVAL '80 days', CURRENT_DATE + INTERVAL '10 days', 120, true),
('a0000001-0001-0001-0001-000000000009', 'preventif_systematique'::type_maintenance, 'Maintenance gilets laser', 'Test batteries, capteurs, firmware update', 30, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '5 days', 180, true),
('a0000001-0002-0001-0001-000000000003', 'preventif_systematique'::type_maintenance, 'Huilage et reglage pistes bowling 1-4', 'Nettoyage machine huilage, reglage debit, verification capteurs', 30, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days', 90, true),
('a0000001-0002-0001-0001-000000000004', 'preventif_systematique'::type_maintenance, 'Huilage et reglage pistes bowling 5-8', 'Nettoyage machine huilage, reglage debit', 30, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days', 90, true),
('a0000001-0002-0001-0001-000000000005', 'preventif_systematique'::type_maintenance, 'Verification bornes recharge karts', 'Test tension, connecteurs, firmware chargeurs', 90, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '30 days', 60, true),
('a0000001-0003-0001-0001-000000000003', 'preventif_conditionnel'::type_maintenance, 'Inspection gonflable geant', 'Inspection coutures, materiau PVC, gonfleur, test pression', 180, CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE + INTERVAL '30 days', 90, true),
('a0000001-0004-0001-0001-000000000004', 'preventif_systematique'::type_maintenance, 'Maintenance laser game ALF', 'Test gilets, pistolets, batteries, capteurs', 30, CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE + INTERVAL '2 days', 120, true),
('a0000001-0001-0001-0001-000000000006', 'reglementaire'::type_maintenance, 'Verification BAES et eclairage securite', 'Test mensuel BAES, eclairage secours, telecommande coupure', 30, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 45, true),
('a0000001-0001-0001-0001-000000000005', 'preventif_systematique'::type_maintenance, 'Inspection structure SoftPlay', 'Verification fixations, tapis, filets, toboggans internes', 180, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '90 days', 240, true),
('a0000001-0004-0001-0001-000000000008', 'preventif_conditionnel'::type_maintenance, 'Inspection gonflable enfants ALF', 'Inspection coutures, gonfleur, test etancheite', 180, CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '60 days', 60, true),
('a0000001-0002-0001-0001-000000000001', 'reglementaire'::type_maintenance, 'Controle reglementaire trampoline annuel', 'Verification complete structure par organisme agree', 365, CURRENT_DATE - INTERVAL '300 days', CURRENT_DATE + INTERVAL '65 days', 480, true);

-- PIECES DETACHEES (stock)
INSERT INTO pieces_detachees (reference, nom, description, fournisseur_id, stock_actuel, stock_min, prix_unitaire_ht, delai_reappro_jours, emplacement) VALUES
('PAD-TRAMP-STD', 'Pad protection trampoline standard', 'Mousse de protection pour cadre trampoline, epaisseur 50mm', 'da4984dd-7dd9-47cf-af3d-e8982f3d6a2c', 8, 5, 45.00, 14, 'Magasin FRA - Etagere A1'),
('PAD-TRAMP-HD', 'Pad protection trampoline haute densite', 'Mousse renforcee haute frequentation, epaisseur 60mm', 'da4984dd-7dd9-47cf-af3d-e8982f3d6a2c', 2, 4, 85.00, 21, 'Magasin FRA - Etagere A1'),
('RESS-TRAMP-8', 'Ressort trampoline 8 pouces', 'Ressort galvanise 8 pouces pour trampoline adulte', 'da4984dd-7dd9-47cf-af3d-e8982f3d6a2c', 25, 10, 12.50, 7, 'Magasin FRA - Bac B3'),
('FILET-TRAMP-5M', 'Filet securite trampoline 5m', 'Filet polyester haute resistance 5m x 2m', 'da4984dd-7dd9-47cf-af3d-e8982f3d6a2c', 3, 2, 120.00, 14, 'Magasin FRA - Etagere A2'),
('BATT-LASER-V2', 'Batterie gilet laser V2', 'Batterie lithium 3.7V 5000mAh pour gilet laser game', NULL, 1, 5, 35.00, 30, 'Magasin FRA - Armoire C1'),
('CAPT-LASER-IR', 'Capteur IR gilet laser', 'Capteur infrarouge de remplacement pour gilet', NULL, 3, 3, 22.00, 30, 'Magasin FRA - Armoire C1'),
('COURR-BOWL-A', 'Courroie machine a quilles type A', 'Courroie transmission pour machine Brunswick', NULL, 4, 3, 65.00, 21, 'Magasin SGB - Rack D1'),
('CAPT-BOWL-VIT', 'Capteur vitesse bowling', 'Capteur optique vitesse de boule', NULL, 1, 2, 180.00, 28, 'Magasin SGB - Rack D1'),
('LED-BOWL-RGB', 'Bandeau LED RGB piste bowling', 'Bandeau LED adressable 5m pour eclairage piste', NULL, 6, 4, 42.00, 10, 'Magasin SGB - Rack D2'),
('BUMP-BOWL-MOT', 'Moteur bumper bowling', 'Moteur electrique remplacement bumper', NULL, 0, 2, 250.00, 35, 'Magasin SGB - Rack D3'),
('TOILE-GONFL-PVC', 'Toile PVC reparation gonflable', 'Kit de reparation PVC pour structure gonflable, 2m2', NULL, 2, 2, 55.00, 14, 'Magasin DOM - Etagere E1'),
('GONFL-MOTEUR', 'Moteur gonfleur remplacement', 'Turbine de gonflage 1.5HP remplacement', NULL, 1, 1, 320.00, 21, 'Magasin DOM - Etagere E2'),
('TAPIS-SOFT-2M', 'Tapis mousse SoftPlay 2m x 1m', 'Tapis de sol haute densite pour zone SoftPlay', NULL, 5, 3, 95.00, 14, 'Magasin FRA - Zone F'),
('BAES-STD', 'Bloc BAES standard', 'Bloc autonome eclairage securite NF C 71-800', NULL, 4, 3, 28.00, 5, 'Magasin FRA - Armoire G'),
('ROBINET-SANIT', 'Robinet mitigeur sanitaire', 'Mitigeur monocommande remplacement bloc sanitaire', NULL, 2, 2, 65.00, 7, 'Magasin FRA - Etagere H');
