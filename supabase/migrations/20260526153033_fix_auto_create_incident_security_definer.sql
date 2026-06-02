/*
  # Fix auto_create_incident trigger to use SECURITY DEFINER

  1. Changes
    - Recreate `auto_create_incident` function with SECURITY DEFINER
    - This allows the trigger to access all tables regardless of the caller's role

  2. Reason
    - Staff PIN users (anon role) insert into controle_items
    - The trigger needs to read niveaux_priorite, bibliotheque_points, equipements
    - These tables have RLS restricted to authenticated
    - As a trigger, it should run with elevated privileges (it's an automatic side-effect)

  3. Security Notes
    - The function only fires as a trigger on controle_items INSERT
    - It cannot be called directly by users
    - search_path is restricted to prevent privilege escalation
*/

CREATE OR REPLACE FUNCTION public.auto_create_incident()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_priorite_id UUID;
  v_equip_categorie_criticite TEXT;
  v_point_bloquant BOOLEAN;
  v_libelle TEXT;
  v_incident_id UUID;
BEGIN
  IF NEW.etat IN ('ok', 'non_saisi') OR NEW.etat IS NULL THEN
    RETURN NEW;
  END IF;

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
