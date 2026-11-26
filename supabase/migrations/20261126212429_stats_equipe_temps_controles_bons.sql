-- Stats : ajout du temps passé sur les contrôles (démarrage → validation)
-- et sur les bons d'intervention (durée saisie).
DROP FUNCTION public.stats_equipe(timestamptz);
CREATE FUNCTION public.stats_equipe(p_depuis timestamptz)
 RETURNS TABLE(
   utilisateur_id uuid, prenom text, nom text, role_code text, parcs text, actif boolean,
   tickets_ouverts bigint, tickets_clotures bigint, interventions bigint, minutes_intervention bigint,
   controles bigint, minutes_controles bigint, bons bigint, minutes_bons bigint,
   connexions bigint, derniere_connexion timestamptz
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT coalesce(acces_tableau_de_bord(), false) THEN
    RAISE EXCEPTION 'Réservé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.prenom::text, u.nom::text, r.code::text,
         (SELECT string_agg(p.code, ', ' ORDER BY p.code) FROM parcs_utilisateurs pu JOIN parcs p ON p.id = pu.parc_id WHERE pu.utilisateur_id = u.id)::text,
         u.actif,
         (SELECT count(*) FROM incidents i WHERE i.declare_par_id = u.id AND i.declare_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation),
         (SELECT count(*) FROM incidents i WHERE i.resolu_par_id = u.id AND i.resolu_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation),
         (SELECT count(*) FROM interventions iv WHERE (iv.technicien_id = u.id OR iv.binome_id = u.id) AND iv.debut >= p_depuis),
         (SELECT coalesce(sum(greatest(0, extract(epoch FROM (iv.fin - iv.debut)) / 60)), 0)::bigint FROM interventions iv
            WHERE (iv.technicien_id = u.id OR iv.binome_id = u.id) AND iv.debut >= p_depuis AND iv.fin IS NOT NULL AND iv.fin - iv.debut < interval '24 hours'),
         (SELECT count(*) FROM controles c WHERE c.realise_par_id = u.id AND c.date_validation >= p_depuis AND NOT coalesce(c.est_formation, false)),
         (SELECT coalesce(sum(greatest(0, extract(epoch FROM (c.date_validation - c.date_demarrage)) / 60)), 0)::bigint FROM controles c
            WHERE c.realise_par_id = u.id AND c.date_validation >= p_depuis AND c.date_demarrage IS NOT NULL
              AND c.date_validation - c.date_demarrage < interval '12 hours' AND NOT coalesce(c.est_formation, false)),
         (SELECT count(*) FROM bons_intervention b WHERE b.cree_par_id = u.id AND b.cree_le >= p_depuis AND b.actif AND NOT coalesce(b.est_formation, false)),
         (SELECT coalesce(sum(b.duree_minutes), 0)::bigint FROM bons_intervention b
            WHERE b.cree_par_id = u.id AND b.cree_le >= p_depuis AND b.actif AND NOT coalesce(b.est_formation, false)),
         (SELECT count(*) FROM journal_connexions j WHERE j.utilisateur_id = u.id AND j.le >= p_depuis),
         greatest((SELECT max(j.le) FROM journal_connexions j WHERE j.utilisateur_id = u.id),
                  (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = u.auth_user_id))
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE coalesce(u.statut_validation, 'valide') <> 'en_attente';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.stats_equipe(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stats_equipe(timestamptz) TO authenticated;
