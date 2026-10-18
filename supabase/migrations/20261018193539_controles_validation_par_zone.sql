-- Contrôles validés zone par zone (zone = activité / catégorie d'équipement).
-- Chaque zone est validée séparément (qui, quand dans controles.meta.zones_validees) ;
-- quand toutes les zones du contrôle sont validées, le contrôle passe en « valide »
-- (ce qui déclenche la notification « contrôle fait »).

CREATE OR REPLACE FUNCTION public.valider_zone_controle(
  p_parc_id uuid,
  p_type text,
  p_date_planifiee date,
  p_realise_par_id uuid,
  p_realise_par_nom text,
  p_realise_par_role text,
  p_zone uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_controle controles%ROWTYPE;
  v_now timestamptz := now();
  v_item jsonb;
  v_points_zone int;
  v_points_saisis int;
  v_zones_total int;
  v_zones_validees int;
  v_deja jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM utilisateurs WHERE id = p_realise_par_id AND actif) THEN
    RAISE EXCEPTION 'Utilisateur invalide ou inactif';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM parcs WHERE id = p_parc_id AND actif) THEN
    RAISE EXCEPTION 'Parc invalide ou inactif';
  END IF;

  -- Tous les points de la zone doivent être saisis
  SELECT count(*) INTO v_points_zone
  FROM v_points_applicables_par_parc
  WHERE parc_id = p_parc_id AND type_controle = p_type::type_controle
    AND actif_pour_parc AND categorie_id = p_zone;
  IF v_points_zone = 0 THEN
    RAISE EXCEPTION 'Zone inconnue pour ce contrôle';
  END IF;
  SELECT count(DISTINCT v.point_id) INTO v_points_saisis
  FROM jsonb_array_elements(p_items) x
  JOIN v_points_applicables_par_parc v
    ON v.point_id = (x->>'point_id')::uuid
   AND v.parc_id = p_parc_id AND v.type_controle = p_type::type_controle
   AND v.actif_pour_parc AND v.categorie_id = p_zone;
  IF v_points_saisis < v_points_zone THEN
    RAISE EXCEPTION 'Zone incomplète : % point(s) sur % saisis', v_points_saisis, v_points_zone;
  END IF;

  SELECT * INTO v_controle
  FROM controles
  WHERE parc_id = p_parc_id AND type = p_type::type_controle
    AND date_planifiee = p_date_planifiee AND NOT est_formation
    AND statut IN ('a_faire', 'en_cours', 'valide')
  ORDER BY (statut = 'valide') DESC, cree_le
  LIMIT 1
  FOR UPDATE;

  IF v_controle.id IS NOT NULL AND v_controle.statut = 'valide' THEN
    RAISE EXCEPTION 'Contrôle déjà validé pour le %', to_char(p_date_planifiee, 'DD/MM/YYYY');
  END IF;

  IF v_controle.id IS NULL THEN
    INSERT INTO controles (parc_id, type, date_planifiee, date_demarrage, realise_par_id,
                           realise_par_nom, realise_par_role, statut, est_formation, meta)
    VALUES (p_parc_id, p_type::type_controle, p_date_planifiee, v_now, p_realise_par_id,
            p_realise_par_nom, p_realise_par_role, 'en_cours', false, '{}'::jsonb)
    RETURNING * INTO v_controle;
  END IF;

  v_deja := coalesce(v_controle.meta, '{}'::jsonb) -> 'zones_validees' -> p_zone::text;
  IF v_deja IS NOT NULL THEN
    RAISE EXCEPTION 'Zone déjà validée par %', coalesce(v_deja->>'par', 'un collègue');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO controle_items (controle_id, point_id, etat, commentaire, photo_url, saisi_par_id)
    VALUES (v_controle.id, (v_item->>'point_id')::uuid, (v_item->>'etat')::etat_controle_item,
            v_item->>'commentaire', v_item->>'photo_url', p_realise_par_id);
  END LOOP;

  UPDATE controles
  SET statut = 'en_cours',
      date_demarrage = coalesce(date_demarrage, v_now),
      meta = jsonb_set(
        coalesce(meta, '{}'::jsonb),
        '{zones_validees}',
        coalesce(meta->'zones_validees', '{}'::jsonb)
          || jsonb_build_object(p_zone::text, jsonb_build_object(
               'par', p_realise_par_nom, 'par_id', p_realise_par_id, 'role', p_realise_par_role, 'le', v_now)))
  WHERE id = v_controle.id
  RETURNING * INTO v_controle;

  SELECT count(DISTINCT categorie_id) INTO v_zones_total
  FROM v_points_applicables_par_parc
  WHERE parc_id = p_parc_id AND type_controle = p_type::type_controle AND actif_pour_parc;
  SELECT count(*) INTO v_zones_validees
  FROM jsonb_object_keys(coalesce(v_controle.meta->'zones_validees', '{}'::jsonb));

  IF v_zones_validees >= v_zones_total THEN
    UPDATE controles
    SET statut = 'valide', date_validation = v_now, valide_par_id = p_realise_par_id,
        realise_par_id = p_realise_par_id, realise_par_nom = p_realise_par_nom,
        realise_par_role = p_realise_par_role
    WHERE id = v_controle.id;
  END IF;

  RETURN jsonb_build_object('controle_id', v_controle.id,
                            'complet', v_zones_validees >= v_zones_total,
                            'zones_validees', v_zones_validees,
                            'zones_total', v_zones_total);
END;
$function$;

-- Zones déjà validées aujourd'hui (lisible par le staff connecté au PIN)
CREATE OR REPLACE FUNCTION public.zones_validees_controle(p_parc_id uuid, p_type text, p_date_planifiee date)
RETURNS TABLE (categorie_id uuid, par text, le timestamptz, controle_valide boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT z.key::uuid, z.value->>'par', (z.value->>'le')::timestamptz, c.statut = 'valide'
  FROM controles c,
       LATERAL jsonb_each(coalesce(c.meta->'zones_validees', '{}'::jsonb)) z
  WHERE c.parc_id = p_parc_id AND c.type = p_type::type_controle
    AND c.date_planifiee = p_date_planifiee AND NOT c.est_formation
    AND c.statut IN ('en_cours', 'valide')
  UNION ALL
  -- Contrôle validé d'un bloc (ancienne méthode) : toutes les zones sont faites
  SELECT DISTINCT v.categorie_id, c.realise_par_nom, c.date_validation, true
  FROM controles c
  JOIN v_points_applicables_par_parc v
    ON v.parc_id = c.parc_id AND v.type_controle = c.type AND v.actif_pour_parc
  WHERE c.parc_id = p_parc_id AND c.type = p_type::type_controle
    AND c.date_planifiee = p_date_planifiee AND NOT c.est_formation
    AND c.statut = 'valide' AND c.meta->'zones_validees' IS NULL;
$function$;

REVOKE ALL ON FUNCTION public.valider_zone_controle(uuid, text, date, uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zones_validees_controle(uuid, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_zone_controle(uuid, text, date, uuid, text, text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zones_validees_controle(uuid, text, date) TO anon, authenticated;
