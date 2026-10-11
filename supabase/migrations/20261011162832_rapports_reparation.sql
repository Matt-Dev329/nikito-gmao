/*
  # Rapports de réparation

  RPC `rapports_reparation(p_depuis, p_formation)` : toutes les réparations
  terminées depuis une date, avec activité, équipement, parc, zone,
  criticité, technicien, dates, diagnostic, actions, 1er coup, photos
  avant/après et pièces utilisées — plus les tickets clôturés par un
  intervenant extérieur (compte-rendu).
  Accessible à tous les rôles sauf staff opérationnel ; périmètre : tous
  les parcs pour direction / chef d'équipe / directeur de parc / admin IT,
  sinon les parcs de l'utilisateur. SECURITY DEFINER pour afficher le nom du
  technicien (non lisible directement par tous les rôles).
*/

CREATE OR REPLACE FUNCTION public.rapports_reparation(p_depuis date, p_formation boolean DEFAULT false)
RETURNS TABLE (
  cle text,
  incident_id uuid,
  numero_bt text,
  activite text,
  categorie text,
  equipement text,
  equipement_code text,
  parc_code text,
  parc_nom text,
  zone text,
  criticite text,
  intervenant text,
  externe boolean,
  debut timestamptz,
  fin timestamptz,
  diagnostic text,
  actions text,
  resolu_premier_coup boolean,
  photos_avant text[],
  photos_apres text[],
  pieces jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
  v_tous boolean;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  v_tous := v_role IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it');

  RETURN QUERY
  -- Réparations faites par l'équipe
  SELECT
    'i:' || iv.id::text,
    i.id, i.numero_bt,
    COALESCE(ce.activite, 'Autres'), ce.nom,
    e.libelle, e.code, p.code, p.nom, z.nom,
    np.code::text,
    NULLIF(trim(COALESCE(u.prenom, '') || ' ' || COALESCE(u.nom, '')), ''),
    false,
    iv.debut, iv.fin,
    iv.diagnostic, iv.actions_realisees, iv.resolu_premier_coup,
    COALESCE(iv.photos_avant, '{}'), COALESCE(iv.photos_apres, '{}'),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', pd.nom, 'reference', pd.reference, 'quantite', pu.quantite) ORDER BY pd.nom)
      FROM pieces_utilisees pu JOIN pieces_detachees pd ON pd.id = pu.piece_id
      WHERE pu.intervention_id = iv.id
    ), '[]'::jsonb)
  FROM interventions iv
  JOIN incidents i ON i.id = iv.incident_id
  LEFT JOIN equipements e ON e.id = i.equipement_id
  LEFT JOIN categories_equipement ce ON ce.id = e.categorie_id
  LEFT JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN zones z ON z.id = e.zone_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  LEFT JOIN utilisateurs u ON u.id = iv.technicien_id
  WHERE iv.fin IS NOT NULL
    AND iv.fin >= p_depuis
    AND i.est_formation = p_formation
    AND (v_tous OR e.parc_id = ANY (current_parc_ids()))

  UNION ALL

  -- Tickets clôturés par un intervenant extérieur
  SELECT
    'e:' || i.id::text,
    i.id, i.numero_bt,
    COALESCE(ce.activite, 'Autres'), ce.nom,
    e.libelle, e.code, p.code, p.nom, z.nom,
    np.code::text,
    COALESCE(f.nom, i.externe_nom, 'Intervenant extérieur'),
    true,
    i.externe_depuis, i.resolu_le,
    NULL::text, i.meta->>'externe_compte_rendu', NULL::boolean,
    '{}'::text[], '{}'::text[], '[]'::jsonb
  FROM incidents i
  LEFT JOIN equipements e ON e.id = i.equipement_id
  LEFT JOIN categories_equipement ce ON ce.id = e.categorie_id
  LEFT JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN zones z ON z.id = e.zone_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  LEFT JOIN fournisseurs f ON f.id = i.externe_fournisseur_id
  WHERE i.externe
    AND i.statut IN ('resolu', 'ferme')
    AND i.meta ? 'externe_compte_rendu'
    AND i.resolu_le >= p_depuis
    AND i.est_formation = p_formation
    AND (v_tous OR e.parc_id = ANY (current_parc_ids()))

  ORDER BY 15 DESC
  LIMIT 1000;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rapports_reparation(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rapports_reparation(date, boolean) TO authenticated;
