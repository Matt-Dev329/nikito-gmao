-- Trigger 1 · auto_create_incident
CREATE OR REPLACE FUNCTION auto_create_incident()
RETURNS TRIGGER AS $$
DECLARE
  v_priorite_id UUID;
  v_equip_categorie_criticite TEXT;
  v_point_bloquant BOOLEAN;
  v_libelle TEXT;
  v_incident_id UUID;
BEGIN
  IF NEW.etat = 'ok' THEN RETURN NEW; END IF;
  SELECT bp.bloquant_si_ko, bp.libelle, ce.criticite_defaut
  INTO v_point_bloquant, v_libelle, v_equip_categorie_criticite
  FROM bibliotheque_points bp
  LEFT JOIN equipements e ON e.id = NEW.equipement_id
  LEFT JOIN categories_equipement ce ON ce.id = e.categorie_id
  WHERE bp.id = NEW.point_id;
  IF NEW.etat = 'hs' OR v_point_bloquant THEN
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'bloquant';
  ELSIF NEW.etat = 'degrade' AND v_equip_categorie_criticite = 'majeur' THEN
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'majeur';
  ELSE
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'mineur';
  END IF;
  INSERT INTO incidents (equipement_id, priorite_id, type_maintenance, titre, description,
    source, declare_par_id, photos_urls, echeance_sla)
  VALUES (NEW.equipement_id, v_priorite_id, 'correctif_curatif',
    'Détecté en contrôle · ' || COALESCE(v_libelle, 'point inconnu'), NEW.commentaire,
    'controle_ouverture', NEW.saisi_par_id,
    CASE WHEN NEW.photo_url IS NOT NULL THEN ARRAY[NEW.photo_url] ELSE ARRAY[]::TEXT[] END,
    NOW() + (SELECT (sla_h || ' hours')::INTERVAL FROM niveaux_priorite WHERE id = v_priorite_id))
  RETURNING id INTO v_incident_id;
  UPDATE controle_items SET incident_genere_id = v_incident_id WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_auto_create_incident AFTER INSERT ON controle_items
  FOR EACH ROW EXECUTE FUNCTION auto_create_incident();

-- Trigger 2 · check_recurrence
CREATE OR REPLACE FUNCTION check_recurrence()
RETURNS TRIGGER AS $$
DECLARE
  v_count_30j INTEGER; v_count_90j INTEGER;
  v_categorie_id UUID; v_count_systemique INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_30j FROM incidents
  WHERE equipement_id = NEW.equipement_id AND declare_le >= NOW() - INTERVAL '30 days';
  IF v_count_30j >= 2 THEN
    UPDATE equipements SET a_surveiller = TRUE WHERE id = NEW.equipement_id;
  END IF;
  SELECT COUNT(*) INTO v_count_90j FROM incidents
  WHERE equipement_id = NEW.equipement_id AND declare_le >= NOW() - INTERVAL '90 days';
  IF v_count_90j >= 3 AND NOT EXISTS (
    SELECT 1 FROM fiches_5_pourquoi
    WHERE equipement_id = NEW.equipement_id AND statut IN ('ouvert','audit_en_cours')
  ) THEN
    INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id)
    VALUES (NEW.id, NEW.equipement_id, NEW.declare_par_id);
  END IF;
  SELECT e.categorie_id INTO v_categorie_id FROM equipements e WHERE e.id = NEW.equipement_id;
  SELECT COUNT(DISTINCT i.equipement_id) INTO v_count_systemique
  FROM incidents i JOIN equipements e ON e.id = i.equipement_id
  WHERE e.categorie_id = v_categorie_id AND i.declare_le >= NOW() - INTERVAL '30 days';
  IF v_count_systemique >= 2 THEN
    INSERT INTO archives_pdf (type, conservation_jusqua, url_storage)
    VALUES ('audit_constructeur', NOW()::DATE + INTERVAL '10 years',
            'pending://systemique-' || v_categorie_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_recurrence AFTER INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION check_recurrence();

-- Trigger 3 · decrement_stock
CREATE OR REPLACE FUNCTION decrement_stock() RETURNS TRIGGER AS $$
BEGIN
  UPDATE pieces_detachees SET stock_actuel = stock_actuel - NEW.quantite, modifie_le = NOW()
  WHERE id = NEW.piece_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_decrement_stock AFTER INSERT ON pieces_utilisees
  FOR EACH ROW EXECUTE FUNCTION decrement_stock();

-- Trigger 4 · update_certification
CREATE OR REPLACE FUNCTION update_certification() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND NEW.type = 'mensuel' THEN
    UPDATE certifications c
    SET prochaine_echeance = c.prochaine_echeance + INTERVAL '1 year', modifie_le = NOW()
    FROM equipements e JOIN parc_attractions pa ON pa.categorie_id = e.categorie_id
    WHERE c.equipement_id = e.id AND pa.parc_id = NEW.parc_id
      AND c.prochaine_echeance < NOW() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_update_certification AFTER UPDATE OF statut ON controles
  FOR EACH ROW EXECUTE FUNCTION update_certification();

-- Trigger 5 · plaintes
CREATE OR REPLACE FUNCTION check_plaintes_recurrence() RETURNS TRIGGER AS $$
DECLARE v_count_plaintes INTEGER; v_priorite_id UUID; v_inc_id UUID;
BEGIN
  IF NEW.equipement_id IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count_plaintes FROM plaintes_clients
  WHERE equipement_id = NEW.equipement_id AND declare_le >= NOW() - INTERVAL '7 days';
  IF v_count_plaintes >= 3 AND NOT EXISTS (
    SELECT 1 FROM incidents
    WHERE equipement_id = NEW.equipement_id AND source = 'previsionnel_auto'
      AND statut NOT IN ('resolu','ferme','annule')
  ) THEN
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'majeur';
    INSERT INTO incidents (equipement_id, priorite_id, type_maintenance, titre, description, source, echeance_sla)
    VALUES (NEW.equipement_id, v_priorite_id, 'preventif_previsionnel',
      '3 plaintes clients en 7 jours · inspection préventive',
      'Génération auto suite règle 4 boucle apprentissage',
      'previsionnel_auto', NOW() + INTERVAL '24 hours')
    RETURNING id INTO v_inc_id;
    UPDATE plaintes_clients SET ticket_genere_id = v_inc_id WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_plaintes AFTER INSERT ON plaintes_clients
  FOR EACH ROW EXECUTE FUNCTION check_plaintes_recurrence();

-- Auto-update modifie_le
CREATE OR REPLACE FUNCTION update_modifie_le() RETURNS TRIGGER AS $$
BEGIN NEW.modifie_le = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_um_parcs BEFORE UPDATE ON parcs FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_equip BEFORE UPDATE ON equipements FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_pieces BEFORE UPDATE ON pieces_detachees FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_inc BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_prev BEFORE UPDATE ON maintenances_preventives FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_cert BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_ctrl BEFORE UPDATE ON controles FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_user BEFORE UPDATE ON utilisateurs FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_5pq BEFORE UPDATE ON fiches_5_pourquoi FOR EACH ROW EXECUTE FUNCTION update_modifie_le();
CREATE TRIGGER trg_um_biblio BEFORE UPDATE ON bibliotheque_points FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

-- VUES KPI
CREATE OR REPLACE VIEW vue_kpi_performance AS
SELECT p.id AS parc_id, p.nom AS parc_nom,
  ROUND(100.0 * (EXTRACT(EPOCH FROM (NOW() - (NOW()::DATE)::TIMESTAMP)) -
    COALESCE(SUM(EXTRACT(EPOCH FROM LEAST(NOW(), COALESCE(i.resolu_le, NOW())) - i.declare_le)), 0))
    / NULLIF(EXTRACT(EPOCH FROM (NOW() - (NOW()::DATE)::TIMESTAMP)), 0), 1) AS performance_pct
FROM parcs p
LEFT JOIN equipements e ON e.parc_id = p.id
LEFT JOIN incidents i ON i.equipement_id = e.id
  AND i.declare_le >= NOW()::DATE
  AND i.priorite_id = (SELECT id FROM niveaux_priorite WHERE code = 'bloquant')
GROUP BY p.id, p.nom;

CREATE OR REPLACE VIEW vue_kpi_mtbf AS
WITH intervals AS (
  SELECT e.parc_id, e.id AS equipement_id,
    EXTRACT(EPOCH FROM (i.declare_le - LAG(i.declare_le) OVER (
      PARTITION BY i.equipement_id ORDER BY i.declare_le))) / 86400.0 AS jours_entre_pannes
  FROM incidents i JOIN equipements e ON e.id = i.equipement_id
  WHERE i.declare_le >= NOW() - INTERVAL '30 days'
)
SELECT parc_id, ROUND(AVG(jours_entre_pannes)::NUMERIC, 1) AS mtbf_jours
FROM intervals WHERE jours_entre_pannes IS NOT NULL GROUP BY parc_id;

CREATE OR REPLACE VIEW vue_kpi_mttr AS
SELECT e.parc_id, ROUND(AVG(EXTRACT(EPOCH FROM (i.fin - i.debut)) / 60.0)::NUMERIC, 0) AS mttr_minutes
FROM interventions i JOIN incidents inc ON inc.id = i.incident_id
JOIN equipements e ON e.id = inc.equipement_id
WHERE i.fin IS NOT NULL AND i.debut >= NOW() - INTERVAL '30 days'
GROUP BY e.parc_id;

CREATE OR REPLACE VIEW vue_kpi_premier_coup AS
SELECT e.parc_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE i.resolu_premier_coup = TRUE) /
    NULLIF(COUNT(*) FILTER (WHERE i.resolu_premier_coup IS NOT NULL), 0), 1) AS premier_coup_pct
FROM interventions i JOIN incidents inc ON inc.id = i.incident_id
JOIN equipements e ON e.id = inc.equipement_id
WHERE i.debut >= NOW() - INTERVAL '30 days'
GROUP BY e.parc_id;

CREATE OR REPLACE VIEW vue_kpi_plaintes AS
SELECT parc_id, COUNT(*) AS plaintes_7j FROM plaintes_clients
WHERE declare_le >= NOW() - INTERVAL '7 days' GROUP BY parc_id;

CREATE OR REPLACE VIEW vue_recurrences_actives AS
SELECT e.id AS equipement_id, e.code, e.libelle, p.nom AS parc_nom,
  COUNT(i.id) FILTER (WHERE i.declare_le >= NOW() - INTERVAL '30 days') AS pannes_30j,
  COUNT(i.id) FILTER (WHERE i.declare_le >= NOW() - INTERVAL '90 days') AS pannes_90j,
  (SELECT COUNT(*) FROM plaintes_clients pc
    WHERE pc.equipement_id = e.id AND pc.declare_le >= NOW() - INTERVAL '7 days') AS plaintes_7j,
  e.a_surveiller,
  EXISTS(SELECT 1 FROM fiches_5_pourquoi f
    WHERE f.equipement_id = e.id AND f.statut IN ('ouvert','audit_en_cours')) AS a_5_pourquoi
FROM equipements e JOIN parcs p ON p.id = e.parc_id
LEFT JOIN incidents i ON i.equipement_id = e.id
GROUP BY e.id, e.code, e.libelle, p.nom, e.a_surveiller
HAVING COUNT(i.id) FILTER (WHERE i.declare_le >= NOW() - INTERVAL '30 days') >= 2
  OR e.a_surveiller = TRUE;

CREATE OR REPLACE VIEW vue_avancement_hebdo AS
SELECT c.id AS controle_id, c.parc_id, p.nom AS parc_nom,
  COUNT(ci.id) AS items_saisis,
  COUNT(ci.id) FILTER (WHERE ci.etat = 'ok') AS items_ok,
  COUNT(ci.id) FILTER (WHERE ci.etat IN ('degrade','hs')) AS items_alerte,
  ROUND(100.0 * COUNT(ci.id) /
    NULLIF((SELECT COUNT(*) FROM bibliotheque_points bp
      JOIN parc_attractions pa ON pa.categorie_id = bp.categorie_id
      WHERE bp.type_controle = 'hebdo' AND pa.parc_id = c.parc_id), 0), 0) AS avancement_pct
FROM controles c JOIN parcs p ON p.id = c.parc_id
LEFT JOIN controle_items ci ON ci.controle_id = c.id
WHERE c.type = 'hebdo' AND c.date_planifiee >= NOW() - INTERVAL '7 days'
GROUP BY c.id, c.parc_id, p.nom;

CREATE OR REPLACE VIEW vue_perf_technicien_30j AS
SELECT u.id AS technicien_id, u.nom, u.prenom, u.trigramme,
  COUNT(i.id) AS bt_clos,
  ROUND(AVG(EXTRACT(EPOCH FROM (i.fin - i.debut)) / 60.0)::NUMERIC, 0) AS mttr_minutes_perso,
  ROUND(100.0 * COUNT(*) FILTER (WHERE i.resolu_premier_coup = TRUE) /
    NULLIF(COUNT(*) FILTER (WHERE i.resolu_premier_coup IS NOT NULL), 0), 1) AS premier_coup_pct,
  COALESCE(SUM((SELECT SUM(quantite) FROM pieces_utilisees pu WHERE pu.intervention_id = i.id)), 0) AS pieces_utilisees
FROM utilisateurs u
LEFT JOIN interventions i ON i.technicien_id = u.id
  AND i.fin IS NOT NULL AND i.debut >= NOW() - INTERVAL '30 days'
WHERE u.role_id IN (SELECT id FROM roles WHERE code IN ('technicien','chef_maintenance'))
GROUP BY u.id, u.nom, u.prenom, u.trigramme;;
