/*
  # Lot 2 - Ajouts equipements + champ commande + controle bowling

  ## Description
  - Ajout des categories d'equipements "Climatisation" et "DM (Declencheur Manuel d'Alarme)"
  - Ajout d'un point de controle obligatoire "Passage machine a huile" pour la categorie Bowling piste
  - Ajout d'un champ `commande` sur la table `equipements`

  ## Tables / Columns Modified
  - `categories_equipement` : insertion de 2 nouvelles lignes (Climatisation, DM)
  - `bibliotheque_points` : insertion d'un nouveau point obligatoire pour bowling
  - `equipements.commande` : nouvelle colonne text nullable
*/

-- 1. Add Climatisation and DM categories
INSERT INTO categories_equipement (nom, description, criticite_defaut)
SELECT 'Climatisation', 'Systemes de climatisation et CVC', 'majeur'
WHERE NOT EXISTS (SELECT 1 FROM categories_equipement WHERE nom = 'Climatisation');


INSERT INTO categories_equipement (nom, description, criticite_defaut)
SELECT 'DM (Declencheur Manuel)', 'Declencheurs manuels d''alarme incendie', 'bloquant'
WHERE NOT EXISTS (SELECT 1 FROM categories_equipement WHERE nom = 'DM (Declencheur Manuel)');


-- 2. Add "commande" column on equipements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'equipements' AND column_name = 'commande'
  ) THEN
    ALTER TABLE equipements ADD COLUMN commande text;

  END IF;

END $$;


-- 3. Add mandatory bowling oil control
INSERT INTO bibliotheque_points (
  categorie_id, libelle, description, type_controle, assigne_a,
  obligation_constructeur, bloquant_si_ko, photo_obligatoire, ordre, verrouille, actif
)
SELECT
  ce.id,
  'Passage machine a huile',
  'Passage obligatoire de la machine a huile sur les pistes (huilage et nettoyage).',
  'hebdo'::type_controle,
  'tech',
  true,
  true,
  false,
  COALESCE((SELECT MAX(ordre) + 10 FROM bibliotheque_points WHERE categorie_id = ce.id), 10),
  false,
  true
FROM categories_equipement ce
WHERE ce.nom ILIKE '%bowling%'
  AND NOT EXISTS (
    SELECT 1 FROM bibliotheque_points bp
    WHERE bp.categorie_id = ce.id AND bp.libelle = 'Passage machine a huile'
  );

;
