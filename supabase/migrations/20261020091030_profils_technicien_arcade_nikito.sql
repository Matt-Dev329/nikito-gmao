-- Profils de technicien : « Technicien Arcade » (uniquement les arcades, tous
-- ses parcs) et « Technicien Nikito » (tout sauf les arcades). Le profil règle
-- specialites / specialites_exclues (déjà utilisées pour les tickets et les
-- notifications) et filtre aussi les équipements et les rapports de réparation.

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS profil_technicien text NOT NULL DEFAULT 'polyvalent'
  CHECK (profil_technicien IN ('polyvalent', 'arcade', 'nikito'));

-- Catégories d'équipement de l'activité Arcade
CREATE OR REPLACE FUNCTION public.categories_arcade()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(id), '{}') FROM categories_equipement WHERE activite ILIKE 'arcade';
$function$;

-- Une catégorie d'équipement est-elle visible pour l'utilisateur connecté ?
-- (toujours vrai hors techniciens)
CREATE OR REPLACE FUNCTION public.categorie_visible_technicien(p_categorie uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT current_role_code()::text IS DISTINCT FROM 'technicien'
      OR (
        (cardinality(current_specialites()) = 0 OR p_categorie = ANY (current_specialites()))
        AND NOT coalesce(p_categorie = ANY (current_specialites_exclues()), false)
      );
$function$;

CREATE OR REPLACE FUNCTION public.definir_profil_technicien(p_utilisateur_id uuid, p_profil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_arcade uuid[] := categories_arcade();
BEGIN
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'admin_it') THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  IF p_profil NOT IN ('polyvalent', 'arcade', 'nikito') THEN
    RAISE EXCEPTION 'Profil inconnu : %', p_profil;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.id = p_utilisateur_id AND r.code = 'technicien'
  ) THEN
    RAISE EXCEPTION 'Le profil ne s''applique qu''aux techniciens';
  END IF;
  UPDATE utilisateurs SET
    profil_technicien = p_profil,
    specialites = CASE WHEN p_profil = 'arcade' THEN v_arcade ELSE '{}' END,
    specialites_exclues = CASE WHEN p_profil = 'nikito' THEN v_arcade ELSE '{}' END
  WHERE id = p_utilisateur_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.categories_arcade() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.categorie_visible_technicien(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_profil_technicien(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.categories_arcade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.categorie_visible_technicien(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_profil_technicien(uuid, text) TO authenticated;

-- Profils actuels : Lili-Marie (arcade), Samy et Baptiste (Nikito, sans arcade)
UPDATE public.utilisateurs SET profil_technicien = 'arcade'
WHERE cardinality(specialites) > 0 AND specialites <@ public.categories_arcade();
UPDATE public.utilisateurs SET profil_technicien = 'nikito'
WHERE cardinality(specialites) = 0 AND cardinality(specialites_exclues) > 0
  AND public.categories_arcade() <@ specialites_exclues;

-- Équipements : un technicien ne voit que les catégories de son profil
ALTER POLICY equip_direction_total ON public.equipements
  USING (
    ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
    OR ((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur AND parc_id = ANY (current_parc_ids()))
    OR ((SELECT current_role_code()) = 'technicien'::role_utilisateur AND parc_id = ANY (current_parc_ids())
        AND categorie_visible_technicien(categorie_id))
  );

-- Rapports de réparation : même filtre pour les techniciens
CREATE OR REPLACE FUNCTION public.rapports_reparation(p_depuis date, p_formation boolean DEFAULT false)
 RETURNS TABLE(cle text, incident_id uuid, numero_bt text, activite text, categorie text, equipement text, equipement_code text, parc_code text, parc_nom text, zone text, criticite text, intervenant text, externe boolean, debut timestamp with time zone, fin timestamp with time zone, diagnostic text, actions text, resolu_premier_coup boolean, photos_avant text[], photos_apres text[], pieces jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := current_role_code()::text;
  v_tous boolean;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  v_tous := v_role IN ('direction', 'chef_maintenance', 'admin_it');

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
    AND categorie_visible_technicien(e.categorie_id)

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
    AND categorie_visible_technicien(e.categorie_id)

  UNION ALL

  -- Tickets supprimés, avec leur motif
  SELECT
    's:' || i.id::text,
    i.id, i.numero_bt,
    COALESCE(ce.activite, 'Autres'), ce.nom,
    e.libelle, e.code, p.code, p.nom, z.nom,
    np.code::text,
    NULLIF(trim(COALESCE(us.prenom, '') || ' ' || COALESCE(us.nom, '')), ''),
    false,
    i.declare_le, i.supprime_le,
    'Ticket supprimé', i.supprime_motif, NULL::boolean,
    '{}'::text[], '{}'::text[], '[]'::jsonb
  FROM incidents i
  LEFT JOIN equipements e ON e.id = i.equipement_id
  LEFT JOIN categories_equipement ce ON ce.id = e.categorie_id
  LEFT JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN zones z ON z.id = e.zone_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  LEFT JOIN utilisateurs us ON us.id = i.supprime_par_id
  WHERE i.statut = 'annule'
    AND i.supprime_le IS NOT NULL
    AND i.supprime_le >= p_depuis
    AND i.est_formation = p_formation
    AND (v_tous OR e.parc_id = ANY (current_parc_ids()))
    AND categorie_visible_technicien(e.categorie_id)

  ORDER BY 15 DESC
  LIMIT 1000;
END;
$function$;
