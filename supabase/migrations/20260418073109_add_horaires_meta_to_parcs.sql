/*
  # Add horaires and meta columns to parcs table

  1. Modified Tables
    - `parcs`
      - `horaires` (jsonb) - Weekly opening hours per day + vacation schedules
      - `meta` (jsonb) - Flexible metadata: vacation mode toggle, vacation end date, etc.

  2. Data Updates
    - ALF (Alfortville): Closed Monday (except vacations), 15h-20h weekdays, 10h-20h Wed/Sat/Sun. Vacations: 10h-20h every day.
    - DOM (Rosny Domus): Open 7/7, late hours (until midnight/1am). Vacations: 10h-00h, last Sunday closes 20h.
    - FRA (Franconville): Same as ALF.
    - SGB (Sainte-Genevieve): Same as DOM except closed Monday outside vacations. Vacations: 10h-00h, last Sunday closes 20h.

  3. Important Notes
    - horaires structure: { "lundi": { "ouverture", "fermeture", "ferme" }, ..., "vacances": { "ouverture", "fermeture", "tous_jours", "dernier_dimanche_fermeture"? } }
    - meta structure: { "est_vacances": bool, "date_fin_vacances"?: "YYYY-MM-DD" }
    - No destructive operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcs' AND column_name = 'horaires'
  ) THEN
    ALTER TABLE parcs ADD COLUMN horaires jsonb DEFAULT '{}'::jsonb;

  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcs' AND column_name = 'meta'
  ) THEN
    ALTER TABLE parcs ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;

  END IF;

END $$;


UPDATE parcs SET horaires = '{
  "lundi": { "ouverture": null, "fermeture": null, "ferme": true },
  "mardi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "mercredi": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "jeudi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "vendredi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "samedi": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "dimanche": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "vacances": { "ouverture": "10:00", "fermeture": "20:00", "tous_jours": true }
}'::jsonb WHERE code = 'ALF';


UPDATE parcs SET horaires = '{
  "lundi": { "ouverture": "18:00", "fermeture": "00:00", "ferme": false },
  "mardi": { "ouverture": "18:00", "fermeture": "00:00", "ferme": false },
  "mercredi": { "ouverture": "10:00", "fermeture": "00:00", "ferme": false },
  "jeudi": { "ouverture": "18:00", "fermeture": "00:00", "ferme": false },
  "vendredi": { "ouverture": "18:00", "fermeture": "01:00", "ferme": false },
  "samedi": { "ouverture": "09:30", "fermeture": "01:00", "ferme": false },
  "dimanche": { "ouverture": "09:30", "fermeture": "00:00", "ferme": false },
  "vacances": { "ouverture": "10:00", "fermeture": "00:00", "tous_jours": true, "dernier_dimanche_fermeture": "20:00" }
}'::jsonb WHERE code = 'DOM';


UPDATE parcs SET horaires = '{
  "lundi": { "ouverture": null, "fermeture": null, "ferme": true },
  "mardi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "mercredi": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "jeudi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "vendredi": { "ouverture": "15:00", "fermeture": "20:00", "ferme": false },
  "samedi": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "dimanche": { "ouverture": "10:00", "fermeture": "20:00", "ferme": false },
  "vacances": { "ouverture": "10:00", "fermeture": "20:00", "tous_jours": true }
}'::jsonb WHERE code = 'FRA';


UPDATE parcs SET horaires = '{
  "lundi": { "ouverture": null, "fermeture": null, "ferme": true },
  "mardi": { "ouverture": "18:00", "fermeture": "00:00", "ferme": false },
  "mercredi": { "ouverture": "10:00", "fermeture": "00:00", "ferme": false },
  "jeudi": { "ouverture": "18:00", "fermeture": "00:00", "ferme": false },
  "vendredi": { "ouverture": "18:00", "fermeture": "01:00", "ferme": false },
  "samedi": { "ouverture": "09:30", "fermeture": "01:00", "ferme": false },
  "dimanche": { "ouverture": "09:30", "fermeture": "00:00", "ferme": false },
  "vacances": { "ouverture": "10:00", "fermeture": "00:00", "tous_jours": true, "dernier_dimanche_fermeture": "20:00" }
}'::jsonb WHERE code = 'SGB';


UPDATE parcs SET meta = '{"est_vacances": false}'::jsonb WHERE meta IS NULL OR meta = '{}'::jsonb;
;
