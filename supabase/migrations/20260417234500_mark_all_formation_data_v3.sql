/*
  # Mark ALL formation data with est_formation = true

  Retroactively marks all training data on newly-added est_formation columns.
  Temporarily disables specific user triggers on controle_items since we
  are only setting a metadata flag, not altering control results.

  1. Data Marked
    - `equipements` — 35 formation equipment (IDs matching a0000001-*)
    - `controle_items` — all items linked to formation controles
    - `interventions` — all interventions linked to formation incidents
    - `certifications` — all certs linked to formation equipment
    - `maintenances_preventives` — all preventive tasks linked to formation equipment
    - `pieces_detachees` — all parts with reference starting with 'FORM-'

  2. Important Notes
    - Temporarily disables user triggers (immutability + auto-incident) for metadata update
    - Triggers are re-enabled immediately after
    - No production data is affected
*/

-- 1. Mark formation equipements
UPDATE equipements
SET est_formation = true
WHERE id::text LIKE 'a0000001-%'
  AND est_formation = false;


-- 2. Disable specific user triggers on controle_items
ALTER TABLE controle_items DISABLE TRIGGER trg_immutabilite_items;

ALTER TABLE controle_items DISABLE TRIGGER trg_auto_create_incident;


UPDATE controle_items
SET est_formation = true
WHERE controle_id IN (SELECT id FROM controles WHERE est_formation = true)
  AND est_formation = false;


-- Re-enable triggers
ALTER TABLE controle_items ENABLE TRIGGER trg_immutabilite_items;

ALTER TABLE controle_items ENABLE TRIGGER trg_auto_create_incident;


-- 3. Mark interventions linked to formation incidents
UPDATE interventions
SET est_formation = true
WHERE incident_id IN (SELECT id FROM incidents WHERE est_formation = true)
  AND est_formation = false;


-- 4. Mark certifications linked to formation equipements
UPDATE certifications
SET est_formation = true
WHERE equipement_id IN (SELECT id FROM equipements WHERE est_formation = true)
  AND est_formation = false;


-- 5. Mark maintenances_preventives linked to formation equipements
UPDATE maintenances_preventives
SET est_formation = true
WHERE equipement_id IN (SELECT id FROM equipements WHERE est_formation = true)
  AND est_formation = false;


-- 6. Mark pieces_detachees created for formation (reference starts with FORM-)
UPDATE pieces_detachees
SET est_formation = true
WHERE reference LIKE 'FORM-%'
  AND est_formation = false;

;
