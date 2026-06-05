-- ============================================================
-- M6 · Ajout du métier sur les fournisseurs
-- ============================================================

-- Type ENUM des métiers (techniques + spécialités parc)
CREATE TYPE metier_fournisseur AS ENUM (
  'plomberie',
  'electricite',
  'cvc_climatisation',
  'maconnerie',
  'menuiserie',
  'vitrerie',
  'serrurerie',
  'ascenseur',
  'securite_incendie',
  'nettoyage',
  'peinture',
  'sol_revetement',
  'karting',
  'trampoline',
  'bowling',
  'arcade_jeux',
  'laser_game',
  'realite_virtuelle',
  'multi_metiers',
  'autre'
);

-- Ajout colonne metiers (array, plusieurs métiers possibles)
ALTER TABLE fournisseurs
  ADD COLUMN metiers metier_fournisseur[] DEFAULT ARRAY[]::metier_fournisseur[],
  ADD COLUMN metier_principal metier_fournisseur;

CREATE INDEX idx_fourn_metier_principal ON fournisseurs(metier_principal);
CREATE INDEX idx_fourn_metiers ON fournisseurs USING GIN(metiers);

-- Mise à jour des 15 fournisseurs existants avec leur métier
UPDATE fournisseurs SET metier_principal = 'karting',           metiers = ARRAY['karting']::metier_fournisseur[]           WHERE nom = 'SODIKART';
UPDATE fournisseurs SET metier_principal = 'karting',           metiers = ARRAY['karting']::metier_fournisseur[]           WHERE nom = 'CHROMATIK';
UPDATE fournisseurs SET metier_principal = 'karting',           metiers = ARRAY['karting']::metier_fournisseur[]           WHERE nom = 'IMPACT Événement';
UPDATE fournisseurs SET metier_principal = 'bowling',           metiers = ARRAY['bowling']::metier_fournisseur[]           WHERE nom = 'QubicaAMF';
UPDATE fournisseurs SET metier_principal = 'bowling',           metiers = ARRAY['bowling']::metier_fournisseur[]           WHERE nom = 'DANELEC';
UPDATE fournisseurs SET metier_principal = 'bowling',           metiers = ARRAY['bowling']::metier_fournisseur[]           WHERE nom = 'GFS';
UPDATE fournisseurs SET metier_principal = 'trampoline',        metiers = ARRAY['trampoline']::metier_fournisseur[]        WHERE nom = 'Airspace';
UPDATE fournisseurs SET metier_principal = 'trampoline',        metiers = ARRAY['trampoline']::metier_fournisseur[]        WHERE nom = 'Superfly Paris';
UPDATE fournisseurs SET metier_principal = 'arcade_jeux',       metiers = ARRAY['arcade_jeux']::metier_fournisseur[]       WHERE nom = 'AMC';
UPDATE fournisseurs SET metier_principal = 'arcade_jeux',       metiers = ARRAY['arcade_jeux']::metier_fournisseur[]       WHERE nom = 'Palomano';
UPDATE fournisseurs SET metier_principal = 'ascenseur',         metiers = ARRAY['ascenseur']::metier_fournisseur[]         WHERE nom = 'Otis';
UPDATE fournisseurs SET metier_principal = 'ascenseur',         metiers = ARRAY['ascenseur']::metier_fournisseur[]         WHERE nom = 'Lehner';
UPDATE fournisseurs SET metier_principal = 'electricite',       metiers = ARRAY['electricite']::metier_fournisseur[]       WHERE nom = 'Schneider Electric';
UPDATE fournisseurs SET metier_principal = 'securite_incendie', metiers = ARRAY['securite_incendie']::metier_fournisseur[] WHERE nom = 'Hamon Access';
UPDATE fournisseurs SET metier_principal = 'autre',             metiers = ARRAY['autre']::metier_fournisseur[]             WHERE nom = 'Dirk Breuer';;
