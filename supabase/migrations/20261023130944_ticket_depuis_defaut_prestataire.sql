-- Un défaut relevé dans un rapport prestataire devient un ticket en un clic.
-- Le ticket garde le parc du rapport (meta.parc_id, pris en compte par
-- parcs_du_ticket quand il n'y a pas d'équipement), sa gravité, le détail et
-- l'action demandée ; un seul ticket par défaut.

CREATE OR REPLACE FUNCTION public.parcs_du_ticket(p_incident_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
SELECT coalesce(
  (SELECT ARRAY[e.parc_id] FROM incidents i JOIN equipements e ON e.id = i.equipement_id WHERE i.id = p_incident_id),
  -- Parc indiqué à la création (ticket sans équipement, ex. défaut de rapport prestataire)
  (SELECT ARRAY[p.id] FROM incidents i JOIN parcs p ON p.id::text = i.meta->>'parc_id' WHERE i.id = p_incident_id),
  (SELECT parcs_de_utilisateur(i.declare_par_id) FROM incidents i WHERE i.id = p_incident_id),
  '{}');
$function$;

CREATE OR REPLACE FUNCTION public.creer_ticket_depuis_defaut(p_document_id uuid, p_intitule text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_doc record;
  v_point jsonb;
  v_existant text;
  v_priorite uuid;
  v_numero text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT d.id, d.parc_id, d.titre, d.prestataire, d.date_document, a.points_non_conformes
    INTO v_doc
  FROM documents_techniques d
  LEFT JOIN analyses_rapports_prestataires a ON a.document_id = d.id
  WHERE d.id = p_document_id AND d.type = 'prestataire' AND d.actif;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapport introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_doc.parc_id) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF v_doc.parc_id IS NULL THEN
    RAISE EXCEPTION 'Range d''abord le rapport dans un parc pour créer le ticket';
  END IF;

  SELECT p INTO v_point
  FROM jsonb_array_elements(coalesce(v_doc.points_non_conformes, '[]'::jsonb)) p
  WHERE trim(p->>'intitule') = trim(p_intitule)
  LIMIT 1;
  IF v_point IS NULL THEN
    RAISE EXCEPTION 'Défaut introuvable dans l''analyse du rapport';
  END IF;

  -- Un seul ticket par défaut (hors tickets supprimés)
  SELECT numero_bt INTO v_existant FROM incidents
  WHERE meta->>'defaut_document_id' = p_document_id::text
    AND trim(meta->>'defaut_intitule') = trim(p_intitule)
    AND statut <> 'annule'
  LIMIT 1;
  IF v_existant IS NOT NULL THEN
    RETURN jsonb_build_object('numero_bt', v_existant, 'existant', true);
  END IF;

  SELECT id INTO v_priorite FROM niveaux_priorite
  WHERE code = CASE v_point->>'gravite' WHEN 'bloquante' THEN 'bloquant' WHEN 'majeure' THEN 'majeur' ELSE 'mineur' END;

  INSERT INTO incidents (titre, description, symptome, priorite_id, type_maintenance, source, declare_par_id,
                         validation_manager, photos_urls, meta)
  VALUES (
    left(v_point->>'intitule', 200),
    concat_ws(E'\n',
      nullif(v_point->>'detail', ''),
      CASE WHEN nullif(v_point->>'action', '') IS NOT NULL THEN 'À faire : ' || (v_point->>'action') END,
      'Source : rapport « ' || v_doc.titre || ' »'
        || coalesce(' (' || nullif(v_doc.prestataire, '') || ')', '')
        || coalesce(' du ' || to_char(v_doc.date_document, 'DD/MM/YYYY'), '')),
    'Défaut rapport prestataire',
    v_priorite,
    'reglementaire',
    'tech_terrain',
    v_moi,
    'auto',
    '{}',
    jsonb_build_object(
      'via', 'rapport_prestataire',
      'parc_id', v_doc.parc_id,
      'defaut_document_id', p_document_id,
      'defaut_intitule', trim(p_intitule),
      'gravite_rapport', v_point->>'gravite'))
  RETURNING numero_bt INTO v_numero;

  RETURN jsonb_build_object('numero_bt', v_numero, 'existant', false);
END;
$function$;
REVOKE ALL ON FUNCTION public.creer_ticket_depuis_defaut(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_ticket_depuis_defaut(uuid, text) TO authenticated;
