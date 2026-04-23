/*
  # Ajout du numero de reader pour les equipements arcade

  1. Modification de la table `equipements`
    - `numero_reader` (text, nullable) : numero du reader de la machine d'arcade
    - Ce champ est uniquement pertinent pour les equipements de categorie "Arcade . borne"
    - Pas de contrainte DB car le filtrage se fait cote UI

  2. Pas de changement de securite (RLS deja en place sur equipements)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipements' AND column_name = 'numero_reader'
  ) THEN
    ALTER TABLE equipements ADD COLUMN numero_reader text;
  END IF;
END $$;
