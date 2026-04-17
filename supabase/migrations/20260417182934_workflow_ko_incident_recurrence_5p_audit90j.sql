/*
  # Workflow complet KO -> Incident -> Recurrence -> 5P -> Audit 90j

  1. Fix trigger trg_auto_create_incident
    - Le trigger existait mais ne se declenchait sur aucun evenement (tgtype bits = 0)
    - Drop + recreate avec AFTER INSERT OR UPDATE OF etat
    - La fonction auto_create_incident() reste inchangee

  2. Update vue_recurrences_actives
    - DROP + CREATE pour ajouter parc_id (impossible de renommer via CREATE OR REPLACE)
    - Seuil inchange: >= 2 incidents en 30j OR a_surveiller = true

  3. Nouveau trigger: 5P cloture -> Audit 90j
    - Quand fiches_5_pourquoi.statut passe a 'clos':
      - Met a jour audit_90j_le = now() + 90 jours
      - Cree une maintenance preventive pour l'audit a 90 jours
    - Fonction fn_5p_cloture_audit avec SET search_path = public

  4. Nouveau trigger: re-panne -> reouverture 5P
    - Quand un incident est cree sur un equipement ayant un 5P clos
      avec audit_90j_le >= today: reouverture automatique du 5P
    - Extension du CHECK sur controles_audit_log.action pour inclure 'reouverture_5p'
    - controle_id rendu nullable pour permettre le log d'evenements non lies a un controle
    - Fonction fn_reopen_5p_if_audit_window avec SET search_path = public

  5. Security
    - Toutes les fonctions ont SET search_path = public
    - Aucun trigger DGCCRF modifie
*/

-- ============================================================
-- BLOC 1: Fix trigger KO -> Incident
-- ============================================================

DROP TRIGGER IF EXISTS trg_auto_create_incident ON controle_items;

CREATE TRIGGER trg_auto_create_incident
  AFTER INSERT OR UPDATE OF etat
  ON controle_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_incident();


-- ============================================================
-- BLOC 2: Recreate vue_recurrences_actives (ajout parc_id)
-- ============================================================

DROP VIEW IF EXISTS vue_recurrences_actives;

CREATE VIEW vue_recurrences_actives AS
SELECT e.id AS equipement_id, e.code, e.libelle,
  p.id AS parc_id, p.nom AS parc_nom,
  count(i.id) FILTER (WHERE i.declare_le >= now() - '30 days'::interval) AS pannes_30j,
  count(i.id) FILTER (WHERE i.declare_le >= now() - '90 days'::interval) AS pannes_90j,
  (SELECT count(*) FROM plaintes_clients pc
   WHERE pc.equipement_id = e.id AND pc.declare_le >= now() - '7 days'::interval) AS plaintes_7j,
  e.a_surveiller,
  EXISTS (SELECT 1 FROM fiches_5_pourquoi f
          WHERE f.equipement_id = e.id AND f.statut IN ('ouvert','audit_en_cours')) AS a_5_pourquoi
FROM equipements e
JOIN parcs p ON p.id = e.parc_id
LEFT JOIN incidents i ON i.equipement_id = e.id
GROUP BY e.id, e.code, e.libelle, p.id, p.nom, e.a_surveiller
HAVING count(i.id) FILTER (WHERE i.declare_le >= now() - '30 days'::interval) >= 2
   OR e.a_surveiller = true;


-- ============================================================
-- BLOC 3: Trigger 5P cloture -> Audit 90j
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_5p_cloture_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_equip_libelle TEXT;
BEGIN
  IF OLD.statut = 'clos' OR NEW.statut != 'clos' THEN
    RETURN NEW;
  END IF;

  UPDATE fiches_5_pourquoi
  SET audit_90j_le = (NOW() + INTERVAL '90 days')::DATE
  WHERE id = NEW.id;

  SELECT libelle INTO v_equip_libelle
  FROM equipements WHERE id = NEW.equipement_id;

  INSERT INTO maintenances_preventives (
    equipement_id, type, libelle, description,
    prochaine_echeance, frequence_jours, actif
  ) VALUES (
    NEW.equipement_id,
    'preventif_systematique',
    'Audit 90j — ' || COALESCE(v_equip_libelle, 'equipement'),
    'Verification efficacite contre-mesure 5P #' || NEW.id::TEXT,
    (NOW() + INTERVAL '90 days')::DATE,
    NULL,
    TRUE
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_5p_cloture_audit ON fiches_5_pourquoi;

CREATE TRIGGER trg_5p_cloture_audit
  AFTER UPDATE OF statut
  ON fiches_5_pourquoi
  FOR EACH ROW
  EXECUTE FUNCTION fn_5p_cloture_audit();


-- ============================================================
-- BLOC 4: Trigger re-panne -> reouverture 5P
-- ============================================================

ALTER TABLE controles_audit_log DROP CONSTRAINT IF EXISTS controles_audit_log_action_check;
ALTER TABLE controles_audit_log ADD CONSTRAINT controles_audit_log_action_check
  CHECK (action = ANY (ARRAY['created','item_added','item_updated','photo_added','validated','corrected','reouverture_5p']));

ALTER TABLE controles_audit_log ALTER COLUMN controle_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_reopen_5p_if_audit_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_5p_id UUID;
BEGIN
  SELECT id INTO v_5p_id
  FROM fiches_5_pourquoi
  WHERE equipement_id = NEW.equipement_id
    AND statut = 'clos'
    AND audit_90j_le IS NOT NULL
    AND audit_90j_le >= CURRENT_DATE
  ORDER BY audit_90j_le DESC
  LIMIT 1;

  IF v_5p_id IS NOT NULL THEN
    UPDATE fiches_5_pourquoi
    SET statut = 'ouvert'
    WHERE id = v_5p_id;

    INSERT INTO controles_audit_log (controle_id, action, details)
    VALUES (
      NULL,
      'reouverture_5p',
      jsonb_build_object(
        'raison', 'Nouvel incident detecte pendant periode audit 90j',
        'incident_id', NEW.id,
        'equipement_id', NEW.equipement_id,
        'fiche_5p_id', v_5p_id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reopen_5p_on_incident ON incidents;

CREATE TRIGGER trg_reopen_5p_on_incident
  AFTER INSERT
  ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION fn_reopen_5p_if_audit_window();
