-- « Voir comme : Arcade consultation » ouvert aux techniciens Arcade
-- (Lili-Marie, Joachim…) : la liste des tickets arcade leur est accessible,
-- limitée à leurs parcs. Lecture seule (ils voient déjà ces tickets).
CREATE OR REPLACE FUNCTION public.tickets_arcade_consultation()
RETURNS TABLE(id uuid, numero_bt text, titre text, description text, symptome text, statut text,
              declare_le timestamptz, resolu_le timestamptz, parc_code text, parc_nom text,
              equipement_code text, equipement_libelle text, numero_reader text, priorite text,
              photos_urls text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := current_role_code()::text;
  v_ses_parcs boolean;
BEGIN
  IF v_role = 'technicien' AND EXISTS (
       SELECT 1 FROM utilisateurs u WHERE u.auth_user_id = auth.uid() AND u.actif AND u.profil_technicien = 'arcade') THEN
    v_ses_parcs := true;
  ELSIF v_role = 'consultation_arcade' THEN
    v_ses_parcs := true;
  ELSIF v_role IN ('direction', 'chef_maintenance', 'admin_it') THEN
    v_ses_parcs := false;
  ELSE
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.numero_bt::text, i.titre::text, i.description::text, i.symptome::text, i.statut::text,
         i.declare_le, i.resolu_le, p.code::text, p.nom::text,
         e.code::text, e.libelle::text, e.numero_reader::text, np.nom::text,
         coalesce(i.photos_urls::text[], '{}'::text[])
  FROM incidents i
  JOIN equipements e ON e.id = i.equipement_id
  JOIN categories_equipement c ON c.id = e.categorie_id
  JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  WHERE lower(trim(c.activite)) = 'arcade'
    AND NOT coalesce(i.est_formation, false)
    AND NOT coalesce(i.est_brouillon, false)
    AND i.supprime_le IS NULL
    AND (NOT v_ses_parcs OR e.parc_id = ANY (current_parc_ids()))
    AND (i.statut::text NOT IN ('resolu', 'annule', 'ferme') OR i.resolu_le > now() - interval '30 days')
  ORDER BY (i.statut::text IN ('resolu', 'annule', 'ferme')), i.declare_le DESC;
END;
$function$;