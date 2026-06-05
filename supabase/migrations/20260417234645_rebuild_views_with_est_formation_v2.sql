/*
  # Rebuild all KPI views to expose est_formation

  Every view now includes an `est_formation` boolean column derived from
  the primary transactional table it queries. This allows the frontend
  to filter views with `.eq('est_formation', false)` in production mode
  or `.eq('est_formation', true)` in formation mode.

  1. Modified Views (dropped and recreated)
    - `vue_kpi_performance` — derives est_formation from incidents
    - `vue_kpi_mtbf` — derives est_formation from incidents
    - `vue_kpi_mttr` — derives est_formation from interventions
    - `vue_kpi_premier_coup` — derives est_formation from interventions
    - `vue_kpi_plaintes` — derives est_formation from plaintes_clients
    - `vue_recurrences_actives` — derives est_formation from equipements
    - `vue_avancement_hebdo` — derives est_formation from controles
    - `vue_perf_technicien_30j` — derives est_formation from interventions

  2. Important Notes
    - Views are dropped and recreated to allow column reordering
    - No data is lost (views are computed, not stored)
    - Frontend queries must add `.eq('est_formation', false)` for production
*/

DROP VIEW IF EXISTS vue_kpi_performance;

DROP VIEW IF EXISTS vue_kpi_mtbf;

DROP VIEW IF EXISTS vue_kpi_mttr;

DROP VIEW IF EXISTS vue_kpi_premier_coup;

DROP VIEW IF EXISTS vue_kpi_plaintes;

DROP VIEW IF EXISTS vue_recurrences_actives;

DROP VIEW IF EXISTS vue_avancement_hebdo;

DROP VIEW IF EXISTS vue_perf_technicien_30j;


-- vue_kpi_performance
CREATE VIEW vue_kpi_performance AS
SELECT
  p.id AS parc_id,
  p.nom AS parc_nom,
  COALESCE(i_agg.est_formation, false) AS est_formation,
  round(
    (100.0 *
      (EXTRACT(epoch FROM (now() - (now()::date)::timestamp with time zone))
       - COALESCE(i_agg.total_downtime, 0))
    / NULLIF(EXTRACT(epoch FROM (now() - (now()::date)::timestamp with time zone)), 0)
    ), 1
  ) AS performance_pct
FROM parcs p
LEFT JOIN (
  SELECT
    e.parc_id,
    i.est_formation,
    sum(EXTRACT(epoch FROM (LEAST(now(), COALESCE(i.resolu_le, now())) - i.declare_le))) AS total_downtime
  FROM incidents i
  JOIN equipements e ON e.id = i.equipement_id
  WHERE i.declare_le >= (now())::date
    AND i.priorite_id = (SELECT id FROM niveaux_priorite WHERE code = 'bloquant')
  GROUP BY e.parc_id, i.est_formation
) i_agg ON i_agg.parc_id = p.id
GROUP BY p.id, p.nom, i_agg.est_formation, i_agg.total_downtime;


-- vue_kpi_mtbf
CREATE VIEW vue_kpi_mtbf AS
WITH intervals AS (
  SELECT
    e.parc_id,
    i.est_formation,
    e.id AS equipement_id,
    (EXTRACT(epoch FROM (i.declare_le - lag(i.declare_le) OVER (PARTITION BY i.equipement_id ORDER BY i.declare_le))) / 86400.0) AS jours_entre_pannes
  FROM incidents i
  JOIN equipements e ON e.id = i.equipement_id
  WHERE i.declare_le >= (now() - '30 days'::interval)
)
SELECT
  parc_id,
  est_formation,
  round(avg(jours_entre_pannes), 1) AS mtbf_jours
FROM intervals
WHERE jours_entre_pannes IS NOT NULL
GROUP BY parc_id, est_formation;


-- vue_kpi_mttr
CREATE VIEW vue_kpi_mttr AS
SELECT
  e.parc_id,
  iv.est_formation,
  round(avg(EXTRACT(epoch FROM (iv.fin - iv.debut)) / 60.0), 0) AS mttr_minutes
FROM interventions iv
JOIN incidents inc ON inc.id = iv.incident_id
JOIN equipements e ON e.id = inc.equipement_id
WHERE iv.fin IS NOT NULL
  AND iv.debut >= (now() - '30 days'::interval)
GROUP BY e.parc_id, iv.est_formation;


-- vue_kpi_premier_coup
CREATE VIEW vue_kpi_premier_coup AS
SELECT
  e.parc_id,
  iv.est_formation,
  round(
    (100.0 * count(*) FILTER (WHERE iv.resolu_premier_coup = true)::numeric)
    / NULLIF(count(*) FILTER (WHERE iv.resolu_premier_coup IS NOT NULL), 0)::numeric
  , 1) AS premier_coup_pct
FROM interventions iv
JOIN incidents inc ON inc.id = iv.incident_id
JOIN equipements e ON e.id = inc.equipement_id
WHERE iv.debut >= (now() - '30 days'::interval)
GROUP BY e.parc_id, iv.est_formation;


-- vue_kpi_plaintes
CREATE VIEW vue_kpi_plaintes AS
SELECT
  parc_id,
  est_formation,
  count(*) AS plaintes_7j
FROM plaintes_clients
WHERE declare_le >= (now() - '7 days'::interval)
GROUP BY parc_id, est_formation;


-- vue_recurrences_actives
CREATE VIEW vue_recurrences_actives WITH (security_invoker = true) AS
SELECT
  e.id AS equipement_id,
  e.code,
  e.libelle,
  e.est_formation,
  p.id AS parc_id,
  p.nom AS parc_nom,
  count(i.id) FILTER (WHERE i.declare_le >= (now() - '30 days'::interval)) AS pannes_30j,
  count(i.id) FILTER (WHERE i.declare_le >= (now() - '90 days'::interval)) AS pannes_90j,
  (SELECT count(*) FROM plaintes_clients pc
   WHERE pc.equipement_id = e.id
     AND pc.declare_le >= (now() - '7 days'::interval)
     AND pc.est_formation = e.est_formation) AS plaintes_7j,
  e.a_surveiller,
  (EXISTS (
    SELECT 1 FROM fiches_5_pourquoi f
    WHERE f.equipement_id = e.id
      AND f.statut IN ('ouvert'::statut_5_pourquoi, 'audit_en_cours'::statut_5_pourquoi)
      AND f.est_formation = e.est_formation
  )) AS a_5_pourquoi
FROM equipements e
JOIN parcs p ON p.id = e.parc_id
LEFT JOIN incidents i ON i.equipement_id = e.id AND i.est_formation = e.est_formation
GROUP BY e.id, e.code, e.libelle, e.est_formation, p.id, p.nom, e.a_surveiller
HAVING count(i.id) FILTER (WHERE i.declare_le >= (now() - '30 days'::interval)) >= 2
   OR e.a_surveiller = true;


-- vue_avancement_hebdo
CREATE VIEW vue_avancement_hebdo AS
SELECT
  c.id AS controle_id,
  c.parc_id,
  p.nom AS parc_nom,
  c.est_formation,
  count(ci.id) AS items_saisis,
  count(ci.id) FILTER (WHERE ci.etat = 'ok'::etat_controle_item) AS items_ok,
  count(ci.id) FILTER (WHERE ci.etat = ANY (ARRAY['degrade'::etat_controle_item, 'hs'::etat_controle_item])) AS items_alerte,
  round(
    (100.0 * count(ci.id)::numeric)
    / NULLIF((
      SELECT count(*)
      FROM bibliotheque_points bp
      JOIN parc_attractions pa ON pa.categorie_id = bp.categorie_id
      WHERE bp.type_controle = 'hebdo'::type_controle
        AND pa.parc_id = c.parc_id
    ), 0)::numeric
  , 0) AS avancement_pct
FROM controles c
JOIN parcs p ON p.id = c.parc_id
LEFT JOIN controle_items ci ON ci.controle_id = c.id
WHERE c.type = 'hebdo'::type_controle
  AND c.date_planifiee >= (now() - '7 days'::interval)
GROUP BY c.id, c.parc_id, p.nom, c.est_formation;


-- vue_perf_technicien_30j
CREATE VIEW vue_perf_technicien_30j AS
SELECT
  u.id AS technicien_id,
  u.nom,
  u.prenom,
  u.trigramme,
  COALESCE(iv.est_formation, false) AS est_formation,
  count(iv.id) AS bt_clos,
  round(avg(EXTRACT(epoch FROM (iv.fin - iv.debut)) / 60.0), 0) AS mttr_minutes_perso,
  round(
    (100.0 * count(*) FILTER (WHERE iv.resolu_premier_coup = true)::numeric)
    / NULLIF(count(*) FILTER (WHERE iv.resolu_premier_coup IS NOT NULL), 0)::numeric
  , 1) AS premier_coup_pct,
  COALESCE(sum((
    SELECT sum(pu.quantite) FROM pieces_utilisees pu WHERE pu.intervention_id = iv.id
  )), 0::numeric) AS pieces_utilisees
FROM utilisateurs u
LEFT JOIN interventions iv ON iv.technicien_id = u.id
  AND iv.fin IS NOT NULL
  AND iv.debut >= (now() - '30 days'::interval)
WHERE u.role_id IN (
  SELECT id FROM roles WHERE code = ANY (ARRAY['technicien'::role_utilisateur, 'chef_maintenance'::role_utilisateur])
)
GROUP BY u.id, u.nom, u.prenom, u.trigramme, iv.est_formation;

;
