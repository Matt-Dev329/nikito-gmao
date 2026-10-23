-- Tableau de bord réservé à Ryad, et à lui seul : les vues d'indicateurs ne
-- renvoient rien aux autres comptes (direction, admin IT et directeurs
-- compris), en plus du masquage à l'écran.

CREATE OR REPLACE FUNCTION public.acces_tableau_de_bord()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = current_utilisateur_id() AND actif AND lower(email) = 'ryad.neki@nikito.com'
  );
$function$;
REVOKE ALL ON FUNCTION public.acces_tableau_de_bord() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_tableau_de_bord() TO authenticated;

CREATE OR REPLACE VIEW public.vue_kpi_performance WITH (security_invoker = true) AS
WITH t AS (
  SELECT parc_ticket(i) AS parc_id,
         i.est_formation,
         CASE
           WHEN i.statut IN ('resolu', 'ferme')
             THEN (EXTRACT(epoch FROM (i.resolu_le - i.declare_le)) / 3600.0) <= coalesce(np.sla_h, 24)
           WHEN (EXTRACT(epoch FROM (now() - i.declare_le)) / 3600.0) > coalesce(np.sla_h, 24)
             THEN false
         END AS dans_les_delais
  FROM incidents i
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  WHERE i.declare_le >= now() - interval '30 days'
    AND i.statut <> 'annule'
    AND (i.validation_manager IS NULL OR i.validation_manager <> 'en_attente')
)
SELECT p.id AS parc_id,
       p.nom AS parc_nom,
       f.est_formation,
       coalesce(round(100.0 * count(*) FILTER (WHERE t.dans_les_delais)
                      / NULLIF(count(*) FILTER (WHERE t.dans_les_delais IS NOT NULL), 0), 1), 100) AS performance_pct
FROM parcs p
CROSS JOIN (VALUES (false), (true)) AS f(est_formation)
LEFT JOIN t ON t.parc_id = p.id AND t.est_formation = f.est_formation
WHERE acces_tableau_de_bord()
GROUP BY p.id, p.nom, f.est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_mtbf WITH (security_invoker = true) AS
WITH pannes AS (
  SELECT e.parc_id,
         i.est_formation,
         i.equipement_id,
         EXTRACT(epoch FROM (i.declare_le - lag(i.declare_le) OVER (PARTITION BY i.equipement_id ORDER BY i.declare_le))) / 86400.0 AS jours_entre_pannes
  FROM incidents i
  JOIN equipements e ON e.id = i.equipement_id
  WHERE i.declare_le >= now() - interval '90 days'
    AND i.statut <> 'annule'
)
SELECT parc_id,
       est_formation,
       round(avg(jours_entre_pannes), 1) AS mtbf_jours
FROM pannes
WHERE jours_entre_pannes IS NOT NULL
  AND jours_entre_pannes >= 1.0 / 24
  AND acces_tableau_de_bord()
GROUP BY parc_id, est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_mttr WITH (security_invoker = true) AS
SELECT parc_ticket(inc) AS parc_id,
       iv.est_formation,
       round(avg(EXTRACT(epoch FROM (iv.fin - iv.debut)) / 60.0), 0) AS mttr_minutes
FROM interventions iv
JOIN incidents inc ON inc.id = iv.incident_id
WHERE iv.fin IS NOT NULL
  AND iv.debut >= now() - interval '30 days'
  AND acces_tableau_de_bord()
GROUP BY parc_ticket(inc), iv.est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_premier_coup WITH (security_invoker = true) AS
WITH resolus AS (
  SELECT parc_ticket(i) AS parc_id,
         i.est_formation,
         (SELECT count(*) FROM interventions iv WHERE iv.incident_id = i.id) AS nb_interventions,
         coalesce(jsonb_array_length(i.meta->'reouvertures'), 0) AS nb_reouvertures
  FROM incidents i
  WHERE i.statut IN ('resolu', 'ferme')
    AND i.resolu_le >= now() - interval '30 days'
)
SELECT parc_id,
       est_formation,
       round(100.0 * count(*) FILTER (WHERE nb_interventions = 1 AND nb_reouvertures = 0)
             / NULLIF(count(*), 0), 1) AS premier_coup_pct
FROM resolus
WHERE nb_interventions >= 1
  AND acces_tableau_de_bord()
GROUP BY parc_id, est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_plaintes WITH (security_invoker = true) AS
SELECT parc_id,
       est_formation,
       count(*) AS plaintes_7j
FROM plaintes_clients
WHERE declare_le >= now() - interval '7 days'
  AND acces_tableau_de_bord()
GROUP BY parc_id, est_formation;
