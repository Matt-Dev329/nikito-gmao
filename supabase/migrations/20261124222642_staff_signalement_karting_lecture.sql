-- Signalement karting par le staff connecté par code PIN (sans compte) :
-- lecture des équipements karting et des symptômes via fonctions limitées aux
-- staff autorisés (signalement_karting) sur leur parc, et dépôt de la photo.
CREATE OR REPLACE FUNCTION public.staff_karting_equipements(p_utilisateur uuid, p_parc uuid)
 RETURNS TABLE(id uuid, code text, libelle text, photo_url text, zone_nom text, categorie_id uuid, categorie_nom text, criticite_defaut text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT e.id, e.code::text, e.libelle::text, e.photo_url::text, z.nom::text, c.id, c.nom::text, c.criticite_defaut::text
  FROM equipements e
  JOIN categories_equipement c ON c.id = e.categorie_id
  LEFT JOIN zones z ON z.id = e.zone_id
  WHERE e.parc_id = p_parc
    AND e.statut = 'actif'
    AND c.activite = 'Karting'
    AND EXISTS (
      SELECT 1 FROM utilisateurs u JOIN parcs_utilisateurs pu ON pu.utilisateur_id = u.id
      WHERE u.id = p_utilisateur AND u.actif AND u.signalement_karting AND pu.parc_id = p_parc)
  ORDER BY e.code;
$function$;
REVOKE EXECUTE ON FUNCTION public.staff_karting_equipements(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_karting_equipements(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_karting_symptomes(p_utilisateur uuid, p_categorie uuid)
 RETURNS TABLE(id uuid, libelle text, icone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.libelle::text, s.icone::text
  FROM symptomes s
  JOIN categories_equipement c ON c.id = s.categorie_id
  WHERE s.categorie_id = p_categorie AND s.actif AND c.activite = 'Karting'
    AND EXISTS (SELECT 1 FROM utilisateurs u WHERE u.id = p_utilisateur AND u.actif AND u.signalement_karting)
  ORDER BY s.ordre, s.libelle;
$function$;
REVOKE EXECUTE ON FUNCTION public.staff_karting_symptomes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_karting_symptomes(uuid, uuid) TO anon, authenticated;

-- Photo / vidéo du signalement (dépôt seul, comme les photos de contrôle)
CREATE POLICY alba_incidents_insert_anon_staff ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'alba-incidents'
    AND (storage.foldername(name))[1] IN (SELECT p.code::text FROM public.parcs p)
  );
