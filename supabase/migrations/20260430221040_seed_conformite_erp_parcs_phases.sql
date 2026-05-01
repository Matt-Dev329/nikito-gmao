/*
  # Seed initial parcs_phases for existing parcs

  Inserts a 'vie_courante' phase for every parc that does not yet have
  a phase entry, using the parc's date_mise_en_production as start date
  (falls back to now() if NULL).
*/

INSERT INTO parcs_phases (parc_id, phase, date_debut, notes)
SELECT
  id,
  'vie_courante',
  COALESCE(date_mise_en_production, now()),
  'Phase initiale automatique - parc déjà ouvert'
FROM parcs
WHERE NOT EXISTS (
  SELECT 1 FROM parcs_phases pp WHERE pp.parc_id = parcs.id
);
