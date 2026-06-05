-- Niveaux de priorité
INSERT INTO niveaux_priorite (code, nom, sla_h, couleur_hex, ordre) VALUES
  ('bloquant', 'Bloquant', 1, '#FF4D6D', 1),
  ('majeur', 'Majeur', 4, '#FFB547', 2),
  ('mineur', 'Mineur', 48, '#D4F542', 3);

-- Rôles
INSERT INTO roles (code, nom, ordre) VALUES
  ('direction', 'Direction', 1),
  ('chef_maintenance', 'Chef d''équipe maintenance', 2),
  ('manager_parc', 'Manager de parc', 3),
  ('technicien', 'Technicien', 4),
  ('staff_operationnel', 'Staff opérationnel', 5);

-- Les 4 parcs
INSERT INTO parcs (code, nom, adresse, ville, code_postal, latitude, longitude, surface_m2, ouvert_7j7) VALUES
  ('FRA', 'Nikito Franconville', 'Centre commercial Quai des Marques', 'Franconville', '95130', 48.9876, 2.2298, 2500, FALSE),
  ('SGB', 'Nikito Sainte-Geneviève-des-Bois', 'Avenue Gabriel Péri', 'Sainte-Geneviève-des-Bois', '91700', 48.6358, 2.3409, 7000, FALSE),
  ('DOM', 'Nikito Rosny Domus', 'Centre Domus', 'Rosny-sous-Bois', '93110', 48.8665, 2.4869, 10000, TRUE),
  ('ALF', 'Nikito Alfortville', 'Quartier des Bords de Seine', 'Alfortville', '94140', 48.8093, 2.4202, 3200, FALSE);

-- Fournisseurs
INSERT INTO fournisseurs (nom, type, numero_contrat, sla_h) VALUES
  ('CHROMATIK', 'maintenance', NULL, 48),
  ('IMPACT Événement', 'maintenance', NULL, 24),
  ('DANELEC', 'maintenance', NULL, 24),
  ('GFS', 'maintenance', NULL, 72),
  ('QubicaAMF', 'norme', NULL, 24),
  ('SODIKART', 'norme', NULL, 24),
  ('Schneider Electric', 'reglementaire', '132326545', 24),
  ('Otis', 'reglementaire', NULL, 24),
  ('Lehner', 'reglementaire', NULL, 48),
  ('AMC', 'reglementaire', NULL, 48),
  ('Hamon Access', 'reglementaire', NULL, 48),
  ('Dirk Breuer', 'audit', NULL, NULL),
  ('Airspace', 'audit', NULL, NULL),
  ('Superfly Paris', 'maintenance', NULL, 72),
  ('Palomano', 'maintenance', NULL, 72);

-- Catégories d'équipements
INSERT INTO categories_equipement (nom, criticite_defaut, norme_associee) VALUES
  ('Trampoline', 'majeur', 'EN ISO 23659:2020'),
  ('SoftPlay', 'majeur', NULL),
  ('Octogone', 'majeur', NULL),
  ('Château gonflable', 'majeur', 'EN 14960:2019'),
  ('Bowling · piste', 'mineur', 'QubicaAMF'),
  ('Prison Island · salle', 'mineur', NULL),
  ('Mini-golf · trou', 'mineur', NULL),
  ('Lancer haches · cible', 'majeur', NULL),
  ('Fléchettes AR · poste', 'mineur', NULL),
  ('Karting · kart', 'majeur', 'SODIKART'),
  ('Karting · borne recharge', 'mineur', 'SODIKART'),
  ('Laser Game · pack', 'mineur', NULL),
  ('Karaoké · salle', 'mineur', NULL),
  ('Immersive VR · salle', 'mineur', NULL),
  ('I-Quiz · pupitre', 'mineur', NULL),
  ('Arcade · borne', 'mineur', NULL),
  ('Ninja · parcours', 'majeur', NULL),
  ('Palomano', 'mineur', NULL),
  ('Escalator', 'bloquant', 'NF EN 115-1'),
  ('Ascenseur PMR', 'bloquant', 'NF EN 81-70'),
  ('Monte-charge', 'majeur', 'NF EN 81-31'),
  ('TGBT', 'bloquant', 'NF C 15-100'),
  ('Projecteur DMX', 'mineur', NULL),
  ('Sanitaire bloc', 'majeur', NULL),
  ('Casier', 'mineur', NULL),
  ('SSI · Solution Incendie', 'bloquant', 'Réglementaire ERP');

-- Mapping parc_attractions
INSERT INTO parc_attractions (parc_id, categorie_id, quantite, meta) VALUES
  -- FRANCONVILLE
  ((SELECT id FROM parcs WHERE code='FRA'), (SELECT id FROM categories_equipement WHERE nom='Trampoline'), 39, '{"unit":"toiles"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='FRA'), (SELECT id FROM categories_equipement WHERE nom='SoftPlay'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='FRA'), (SELECT id FROM categories_equipement WHERE nom='Ninja · parcours'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='FRA'), (SELECT id FROM categories_equipement WHERE nom='Laser Game · pack'), 30, '{"systeme":"LaserBlast"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='FRA'), (SELECT id FROM categories_equipement WHERE nom='Arcade · borne'), 29, '{"prefixe":"FRA-"}'::jsonb),
  -- SGB
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Trampoline'), 37, '{"unit":"toiles"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='SoftPlay'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Octogone'), 1, '{"prestataire":"IMPACT"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Château gonflable'), 1, '{"modele":"AirX","cert":"4279"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Bowling · piste'), 20, '{"fabricant":"QubicaAMF"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Prison Island · salle'), 37, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Mini-golf · trou'), 12, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Lancer haches · cible'), 5, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Fléchettes AR · poste'), 4, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Laser Game · pack'), 40, '{"systeme":"LaserBlast"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Arcade · borne'), 35, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='SGB'), (SELECT id FROM categories_equipement WHERE nom='Escalator'), 1, '{"contrat":"132326545"}'::jsonb),
  -- ROSNY
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Trampoline'), 25, '{"unit":"toiles"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='SoftPlay'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Ninja · parcours'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Bowling · piste'), 16, '{"fabricant":"QubicaAMF","type":"Hyper Bowling"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Prison Island · salle'), 35, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Mini-golf · trou'), 9, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Lancer haches · cible'), 3, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Fléchettes AR · poste'), 4, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Karting · kart'), 22, '{"fabricant":"SODIKART"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Karting · borne recharge'), 11, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Laser Game · pack'), 32, '{"systeme":"Delta Strike"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Karaoké · salle'), 3, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Immersive VR · salle'), 4, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='I-Quiz · pupitre'), 11, '{"detail":"5+6"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='DOM'), (SELECT id FROM categories_equipement WHERE nom='Arcade · borne'), 50, '{"prefixe":"DOM-"}'::jsonb),
  -- ALFORTVILLE
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='Trampoline'), 1, '{"surface_m2":1220}'::jsonb),
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='SoftPlay'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='Ninja · parcours'), 1, '{}'::jsonb),
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='Laser Game · pack'), 35, '{"systeme":"LaserBlast"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='Arcade · borne'), 14, '{"prefixe":"ALF-"}'::jsonb),
  ((SELECT id FROM parcs WHERE code='ALF'), (SELECT id FROM categories_equipement WHERE nom='Palomano'), 1, '{"franchise":true}'::jsonb);;
