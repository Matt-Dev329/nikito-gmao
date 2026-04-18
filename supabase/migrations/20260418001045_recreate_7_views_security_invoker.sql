/*
  # Recreate 7 dashboard views with security_invoker = true

  These views were flagged as SECURITY DEFINER because they are owned by a
  privileged role and did not opt-in to security_invoker mode.
  With security_invoker = true the view executes queries using the
  calling user's permissions, which respects RLS policies on the
  underlying tables.

  1. Affected views (dropped and recreated):
     - vue_avancement_hebdo
     - vue_kpi_premier_coup
     - vue_kpi_mttr
     - vue_kpi_plaintes
     - vue_kpi_mtbf
     - vue_perf_technicien_30j
     - vue_kpi_performance

  2. Security
     - All views now use WITH (security_invoker = true)
     - No SECURITY DEFINER, no security_barrier
     - est_formation kept as output column (frontend filters on it)

  3. Important notes
     - View definitions are identical to their originals
     - No data is modified or deleted
*/

-- 1. vue_avancement_hebdo
DROP VIEW IF EXISTS vue_avancement_hebdo;
CREATE VIEW vue_avancement_hebdo
WITH (security_invoker = true)
AS
SELECT c.id AS controle_id,
    c.parc_id,
    p.nom AS parc_nom,
    c.est_formation,
    count(ci.id) AS items_saisis,
    count(ci.id) FILTER (WHERE ci.etat = 'ok'::etat_controle_item) AS items_ok,
    count(ci.id) FILTER (WHERE ci.etat = ANY (ARRAY['degrade'::etat_controle_item, 'hs'::etat_controle_item])) AS items_alerte,
    round(100.0 * count(ci.id)::numeric / NULLIF(( SELECT count(*) AS count
           FROM bibliotheque_points bp
             JOIN parc_attractions pa ON pa.categorie_id = bp.categorie_id
          WHERE bp.type_controle = 'hebdo'::type_controle AND pa.parc_id = c.parc_id), 0)::numeric, 0) AS avancement_pct
   FROM controles c
     JOIN parcs p ON p.id = c.parc_id
     LEFT JOIN controle_items ci ON ci.controle_id = c.id
  WHERE c.type = 'hebdo'::type_controle AND c.date_planifiee >= (now() - '7 days'::interval)
  GROUP BY c.id, c.parc_id, p.nom, c.est_formation;

-- 2. vue_kpi_mtbf
DROP VIEW IF EXISTS vue_kpi_mtbf;
CREATE VIEW vue_kpi_mtbf
WITH (security_invoker = true)
AS
WITH intervals AS (
    SELECT e.parc_id,
        i.est_formation,
        e.id AS equipement_id,
        EXTRACT(epoch FROM i.declare_le - lag(i.declare_le) OVER (PARTITION BY i.equipement_id ORDER BY i.declare_le)) / 86400.0 AS jours_entre_pannes
    FROM incidents i
        JOIN equipements e ON e.id = i.equipement_id
    WHERE i.declare_le >= (now() - '30 days'::interval)
)
SELECT parc_id,
    est_formation,
    round(avg(jours_entre_pannes), 1) AS mtbf_jours
FROM intervals
WHERE jours_entre_pannes IS NOT NULL
GROUP BY parc_id, est_formation;

-- 3. vue_kpi_mttr
DROP VIEW IF EXISTS vue_kpi_mttr;
CREATE VIEW vue_kpi_mttr
WITH (security_invoker = true)
AS
SELECT e.parc_id,
    iv.est_formation,
    round(avg(EXTRACT(epoch FROM iv.fin - iv.debut) / 60.0), 0) AS mttr_minutes
FROM interventions iv
    JOIN incidents inc ON inc.id = iv.incident_id
    JOIN equipements e ON e.id = inc.equipement_id
WHERE iv.fin IS NOT NULL AND iv.debut >= (now() - '30 days'::interval)
GROUP BY e.parc_id, iv.est_formation;

-- 4. vue_kpi_premier_coup
DROP VIEW IF EXISTS vue_kpi_premier_coup;
CREATE VIEW vue_kpi_premier_coup
WITH (security_invoker = true)
AS
SELECT e.parc_id,
    iv.est_formation,
    round(100.0 * count(*) FILTER (WHERE iv.resolu_premier_coup = true)::numeric / NULLIF(count(*) FILTER (WHERE iv.resolu_premier_coup IS NOT NULL), 0)::numeric, 1) AS premier_coup_pct
FROM interventions iv
    JOIN incidents inc ON inc.id = iv.incident_id
    JOIN equipements e ON e.id = inc.equipement_id
WHERE iv.debut >= (now() - '30 days'::interval)
GROUP BY e.parc_id, iv.est_formation;

-- 5. vue_kpi_plaintes
DROP VIEW IF EXISTS vue_kpi_plaintes;
CREATE VIEW vue_kpi_plaintes
WITH (security_invoker = true)
AS
SELECT parc_id,
    est_formation,
    count(*) AS plaintes_7j
FROM plaintes_clients
WHERE declare_le >= (now() - '7 days'::interval)
GROUP BY parc_id, est_formation;

-- 6. vue_perf_technicien_30j
DROP VIEW IF EXISTS vue_perf_technicien_30j;
CREATE VIEW vue_perf_technicien_30j
WITH (security_invoker = true)
AS
SELECT u.id AS technicien_id,
    u.nom,
    u.prenom,
    u.trigramme,
    COALESCE(iv.est_formation, false) AS est_formation,
    count(iv.id) AS bt_clos,
    round(avg(EXTRACT(epoch FROM iv.fin - iv.debut) / 60.0), 0) AS mttr_minutes_perso,
    round(100.0 * count(*) FILTER (WHERE iv.resolu_premier_coup = true)::numeric / NULLIF(count(*) FILTER (WHERE iv.resolu_premier_coup IS NOT NULL), 0)::numeric, 1) AS premier_coup_pct,
    COALESCE(sum(( SELECT sum(pu.quantite) AS sum
           FROM pieces_utilisees pu
          WHERE pu.intervention_id = iv.id)), 0::numeric) AS pieces_utilisees
FROM utilisateurs u
    LEFT JOIN interventions iv ON iv.technicien_id = u.id AND iv.fin IS NOT NULL AND iv.debut >= (now() - '30 days'::interval)
WHERE (u.role_id IN ( SELECT roles.id
           FROM roles
          WHERE roles.code = ANY (ARRAY['technicien'::role_utilisateur, 'chef_maintenance'::role_utilisateur])))
GROUP BY u.id, u.nom, u.prenom, u.trigramme, iv.est_formation;

-- 7. vue_kpi_performance
DROP VIEW IF EXISTS vue_kpi_performance;
CREATE VIEW vue_kpi_performance
WITH (security_invoker = true)
AS
SELECT p.id AS parc_id,
    p.nom AS parc_nom,
    COALESCE(i_agg.est_formation, false) AS est_formation,
    round(100.0 * (EXTRACT(epoch FROM now() - now()::date::timestamp with time zone) - COALESCE(i_agg.total_downtime, 0::numeric)) / NULLIF(EXTRACT(epoch FROM now() - now()::date::timestamp with time zone), 0::numeric), 1) AS performance_pct
FROM parcs p
    LEFT JOIN ( SELECT e.parc_id,
            i.est_formation,
            sum(EXTRACT(epoch FROM LEAST(now(), COALESCE(i.resolu_le, now())) - i.declare_le)) AS total_downtime
        FROM incidents i
            JOIN equipements e ON e.id = i.equipement_id
        WHERE i.declare_le >= now()::date AND i.priorite_id = (( SELECT niveaux_priorite.id
                FROM niveaux_priorite
                WHERE niveaux_priorite.code = 'bloquant'::text))
        GROUP BY e.parc_id, i.est_formation) i_agg ON i_agg.parc_id = p.id
GROUP BY p.id, p.nom, i_agg.est_formation, i_agg.total_downtime;