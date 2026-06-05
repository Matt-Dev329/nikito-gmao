
CREATE OR REPLACE FUNCTION public.auto_create_incident()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_priorite_id UUID;
  v_equip_categorie_criticite TEXT;
  v_point_bloquant BOOLEAN;
  v_libelle TEXT;
  v_incident_id UUID;
BEGIN
  -- Sortie anticipée : pas d'incident si l'item n'est pas en état problématique
  -- (incluant 'non_saisi' = item juste créé, pas encore évalué)
  IF NEW.etat IN ('ok', 'non_saisi') OR NEW.etat IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sortie aussi si pas d'équipement rattaché (cas contrôle quotidien générique
  -- sur un point de bibliothèque non lié à un équipement précis)
  IF NEW.equipement_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT bp.bloquant_si_ko, bp.libelle, ce.criticite_defaut
  INTO v_point_bloquant, v_libelle, v_equip_categorie_criticite
  FROM bibliotheque_points bp
  LEFT JOIN equipements e ON e.id = NEW.equipement_id
  LEFT JOIN categories_equipement ce ON ce.id = e.categorie_id
  WHERE bp.id = NEW.point_id;

  IF NEW.etat = 'hs' OR v_point_bloquant THEN
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'bloquant';
  ELSIF NEW.etat = 'degrade' AND v_equip_categorie_criticite = 'majeur' THEN
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'majeur';
  ELSE
    SELECT id INTO v_priorite_id FROM niveaux_priorite WHERE code = 'mineur';
  END IF;

  INSERT INTO incidents (equipement_id, priorite_id, type_maintenance, titre, description,
    source, declare_par_id, photos_urls, echeance_sla)
  VALUES (NEW.equipement_id, v_priorite_id, 'correctif_curatif',
    'Détecté en contrôle · ' || COALESCE(v_libelle, 'point inconnu'), NEW.commentaire,
    'controle_ouverture', NEW.saisi_par_id,
    CASE WHEN NEW.photo_url IS NOT NULL THEN ARRAY[NEW.photo_url] ELSE ARRAY[]::TEXT[] END,
    NOW() + (SELECT (sla_h || ' hours')::INTERVAL FROM niveaux_priorite WHERE id = v_priorite_id))
  RETURNING id INTO v_incident_id;

  UPDATE controle_items SET incident_genere_id = v_incident_id WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
;
