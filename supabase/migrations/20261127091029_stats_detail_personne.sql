-- Stats : détail d'une personne sur la période (tickets, interventions, contrôles, bons, blessés, connexions). Réservé au tableau de bord.
CREATE OR REPLACE FUNCTION public.stats_detail_personne(p_utilisateur_id uuid, p_depuis timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT coalesce(acces_tableau_de_bord(), false) THEN
    RAISE EXCEPTION 'Réservé' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'tickets_ouverts', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT i.numero_bt, i.titre, i.statut::text AS statut, i.declare_le AS le, p.code AS parc, e.libelle AS equipement
      FROM incidents i LEFT JOIN equipements e ON e.id = i.equipement_id LEFT JOIN parcs p ON p.id = e.parc_id
      WHERE i.declare_par_id = p_utilisateur_id AND i.declare_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation
      ORDER BY i.declare_le DESC LIMIT 300) x), '[]'::jsonb),
    'tickets_clotures', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT i.numero_bt, i.titre, i.resolu_le AS le, i.declare_le, p.code AS parc, e.libelle AS equipement
      FROM incidents i LEFT JOIN equipements e ON e.id = i.equipement_id LEFT JOIN parcs p ON p.id = e.parc_id
      WHERE i.resolu_par_id = p_utilisateur_id AND i.resolu_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation
      ORDER BY i.resolu_le DESC LIMIT 300) x), '[]'::jsonb),
    'interventions', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT i.numero_bt, i.titre, iv.debut AS le, iv.fin,
             CASE WHEN iv.fin IS NOT NULL AND iv.fin - iv.debut < interval '24 hours'
                  THEN greatest(0, extract(epoch FROM (iv.fin - iv.debut)) / 60)::int END AS minutes,
             iv.diagnostic, iv.actions_realisees, p.code AS parc, (iv.binome_id = p_utilisateur_id) AS en_binome
      FROM interventions iv JOIN incidents i ON i.id = iv.incident_id
      LEFT JOIN equipements e ON e.id = i.equipement_id LEFT JOIN parcs p ON p.id = e.parc_id
      WHERE (iv.technicien_id = p_utilisateur_id OR iv.binome_id = p_utilisateur_id) AND iv.debut >= p_depuis
      ORDER BY iv.debut DESC LIMIT 300) x), '[]'::jsonb),
    'controles', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT c.type::text AS type, c.date_validation AS le, p.code AS parc,
             CASE WHEN c.date_demarrage IS NOT NULL AND c.date_validation - c.date_demarrage < interval '12 hours'
                  THEN greatest(0, extract(epoch FROM (c.date_validation - c.date_demarrage)) / 60)::int END AS minutes
      FROM controles c LEFT JOIN parcs p ON p.id = c.parc_id
      WHERE c.realise_par_id = p_utilisateur_id AND c.date_validation >= p_depuis AND NOT coalesce(c.est_formation, false)
      ORDER BY c.date_validation DESC LIMIT 300) x), '[]'::jsonb),
    'bons', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT b.numero, b.date_intervention AS le, b.activite, b.equipement, b.duree_minutes AS minutes, p.code AS parc
      FROM bons_intervention b LEFT JOIN parcs p ON p.id = b.parc_id
      WHERE b.cree_par_id = p_utilisateur_id AND b.cree_le >= p_depuis AND b.actif AND NOT coalesce(b.est_formation, false)
      ORDER BY b.date_intervention DESC LIMIT 300) x), '[]'::jsonb),
    'blesses', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT d.numero, d.declare_le AS le, d.niveau::text AS niveau, d.activite, d.evacuation_hopital, p.code AS parc,
             (d.declare_par_id = p_utilisateur_id) AS declare, (d.client_appele_par_id = p_utilisateur_id) AS appel
      FROM declarations_blesses d LEFT JOIN parcs p ON p.id = d.parc_id
      WHERE d.supprime_le IS NULL
        AND ((d.declare_par_id = p_utilisateur_id AND d.declare_le >= p_depuis)
          OR (d.client_appele_par_id = p_utilisateur_id AND d.client_appele_le >= p_depuis))
      ORDER BY d.declare_le DESC LIMIT 300) x), '[]'::jsonb),
    'connexions', coalesce((SELECT jsonb_agg(x ORDER BY x.le DESC) FROM (
      SELECT j.le, j.mode, j.appareil FROM journal_connexions j
      WHERE j.utilisateur_id = p_utilisateur_id AND j.le >= p_depuis
      ORDER BY j.le DESC LIMIT 100) x), '[]'::jsonb)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.stats_detail_personne(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stats_detail_personne(uuid, timestamptz) TO authenticated;
