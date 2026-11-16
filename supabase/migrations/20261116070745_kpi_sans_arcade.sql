-- Tableau de bord : les tickets Arcade ne comptent plus dans les indicateurs
-- (performance / délais, MTBF, MTTR, résolu du 1er coup).
CREATE OR REPLACE FUNCTION public.ticket_est_arcade(p_equipement_id uuid, p_meta jsonb)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT coalesce(
    coalesce(
      (SELECT e.categorie_id FROM equipements e WHERE e.id = p_equipement_id),
      CASE WHEN p_meta->>'categorie_id' ~* '^[0-9a-f-]{36}$' THEN (p_meta->>'categorie_id')::uuid END
    ) = ANY (categories_arcade()),
    false);
$function$;

REVOKE EXECUTE ON FUNCTION public.ticket_est_arcade(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_est_arcade(uuid, jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.vue_kpi_mtbf WITH (security_invoker = true) AS
 WITH pannes AS (
         SELECT e.parc_id,
            i.est_formation,
            i.equipement_id,
            (EXTRACT(epoch FROM (i.declare_le - lag(i.declare_le) OVER (PARTITION BY i.equipement_id ORDER BY i.declare_le))) / 86400.0) AS jours_entre_pannes
           FROM (incidents i
             JOIN equipements e ON ((e.id = i.equipement_id)))
          WHERE ((i.declare_le >= (now() - '90 days'::interval)) AND (i.statut <> 'annule'::statut_incident)
                 AND NOT coalesce(e.categorie_id = ANY (categories_arcade()), false))
        )
 SELECT parc_id,
    est_formation,
    round(avg(jours_entre_pannes), 1) AS mtbf_jours
   FROM pannes
  WHERE ((jours_entre_pannes IS NOT NULL) AND (jours_entre_pannes >= (1.0 / (24)::numeric)) AND acces_tableau_de_bord())
  GROUP BY parc_id, est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_mttr WITH (security_invoker = true) AS
 SELECT parc_ticket(inc.*) AS parc_id,
    iv.est_formation,
    round(avg((EXTRACT(epoch FROM (iv.fin - iv.debut)) / 60.0)), 0) AS mttr_minutes
   FROM (interventions iv
     JOIN incidents inc ON ((inc.id = iv.incident_id)))
  WHERE ((iv.fin IS NOT NULL) AND (iv.debut >= (now() - '30 days'::interval)) AND acces_tableau_de_bord()
         AND NOT ticket_est_arcade(inc.equipement_id, inc.meta))
  GROUP BY (parc_ticket(inc.*)), iv.est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_performance WITH (security_invoker = true) AS
 WITH t AS (
         SELECT parc_ticket(i.*) AS parc_id,
            i.est_formation,
                CASE
                    WHEN (i.statut = ANY (ARRAY['resolu'::statut_incident, 'ferme'::statut_incident])) THEN ((EXTRACT(epoch FROM (i.resolu_le - i.declare_le)) / 3600.0) <= (COALESCE(np.sla_h, 24))::numeric)
                    WHEN ((EXTRACT(epoch FROM (now() - i.declare_le)) / 3600.0) > (COALESCE(np.sla_h, 24))::numeric) THEN false
                    ELSE NULL::boolean
                END AS dans_les_delais
           FROM (incidents i
             LEFT JOIN niveaux_priorite np ON ((np.id = i.priorite_id)))
          WHERE ((i.declare_le >= (now() - '30 days'::interval)) AND (i.statut <> 'annule'::statut_incident) AND ((i.validation_manager IS NULL) OR (i.validation_manager <> 'en_attente'::text))
                 AND NOT ticket_est_arcade(i.equipement_id, i.meta))
        )
 SELECT p.id AS parc_id,
    p.nom AS parc_nom,
    f.est_formation,
    COALESCE(round(((100.0 * (count(*) FILTER (WHERE t.dans_les_delais))::numeric) / (NULLIF(count(*) FILTER (WHERE (t.dans_les_delais IS NOT NULL)), 0))::numeric), 1), (100)::numeric) AS performance_pct
   FROM ((parcs p
     CROSS JOIN ( VALUES (false), (true)) f(est_formation))
     LEFT JOIN t ON (((t.parc_id = p.id) AND (t.est_formation = f.est_formation))))
  WHERE acces_tableau_de_bord()
  GROUP BY p.id, p.nom, f.est_formation;

CREATE OR REPLACE VIEW public.vue_kpi_premier_coup WITH (security_invoker = true) AS
 WITH resolus AS (
         SELECT parc_ticket(i.*) AS parc_id,
            i.est_formation,
            ( SELECT count(*) AS count
                   FROM interventions iv
                  WHERE (iv.incident_id = i.id)) AS nb_interventions,
            COALESCE(jsonb_array_length((i.meta -> 'reouvertures'::text)), 0) AS nb_reouvertures
           FROM incidents i
          WHERE ((i.statut = ANY (ARRAY['resolu'::statut_incident, 'ferme'::statut_incident])) AND (i.resolu_le >= (now() - '30 days'::interval))
                 AND NOT ticket_est_arcade(i.equipement_id, i.meta))
        )
 SELECT parc_id,
    est_formation,
    round(((100.0 * (count(*) FILTER (WHERE ((nb_interventions = 1) AND (nb_reouvertures = 0))))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS premier_coup_pct
   FROM resolus
  WHERE ((nb_interventions >= 1) AND acces_tableau_de_bord())
  GROUP BY parc_id, est_formation;