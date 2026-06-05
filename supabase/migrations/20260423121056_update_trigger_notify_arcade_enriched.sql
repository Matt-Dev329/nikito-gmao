/*
  # Enrichissement du trigger notification arcade

  1. Modification de la fonction `fn_notify_arcade_incident()`
    - Ajout des champs : numero_serie, date_mise_service, date_fin_garantie,
      revenu_journalier_estime, statut_equipement, zone dans le payload JSON
    - Calcul automatique de la garantie (active/expiree)
    - Ces donnees permettent au fournisseur d'identifier precisement la machine
      et d'evaluer l'impact financier de la panne
*/

CREATE OR REPLACE FUNCTION public.fn_notify_arcade_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipement RECORD;

  v_parc RECORD;

  v_priorite_nom TEXT;

  v_declarant_nom TEXT;

  v_zone_nom TEXT;

  v_payload JSONB;

  v_project_url TEXT;

  v_anon_key TEXT;

  v_request_id BIGINT;

  v_garantie_active BOOLEAN;

BEGIN
  IF NEW.est_formation THEN
    RETURN NEW;

  END IF;


  SELECT e.code, e.libelle, e.parc_id, e.numero_serie,
         e.date_mise_service, e.date_fin_garantie,
         e.revenu_journalier_estime, e.statut AS statut_equipement,
         e.zone_id,
         ce.nom AS categorie_nom
  INTO v_equipement
  FROM equipements e
  JOIN categories_equipement ce ON ce.id = e.categorie_id
  WHERE e.id = NEW.equipement_id;


  IF NOT FOUND THEN
    RETURN NEW;

  END IF;


  IF v_equipement.categorie_nom NOT ILIKE '%arcade%' THEN
    RETURN NEW;

  END IF;


  SELECT code, nom INTO v_parc
  FROM parcs WHERE id = v_equipement.parc_id;


  SELECT nom INTO v_priorite_nom
  FROM niveaux_priorite WHERE id = NEW.priorite_id;


  SELECT (prenom || ' ' || nom) INTO v_declarant_nom
  FROM utilisateurs WHERE id = NEW.declare_par_id;


  -- Zone
  IF v_equipement.zone_id IS NOT NULL THEN
    SELECT nom INTO v_zone_nom FROM zones WHERE id = v_equipement.zone_id;

  END IF;


  -- Garantie active ?
  v_garantie_active := (v_equipement.date_fin_garantie IS NOT NULL
                        AND v_equipement.date_fin_garantie >= CURRENT_DATE);


  v_payload := jsonb_build_object(
    'incident_id', NEW.id,
    'numero_bt', NEW.numero_bt,
    'titre', NEW.titre,
    'description', NEW.description,
    'symptome', NEW.symptome,
    'statut', NEW.statut::text,
    'priorite', COALESCE(v_priorite_nom, 'Non definie'),
    'equipement_code', v_equipement.code,
    'equipement_libelle', v_equipement.libelle,
    'numero_serie', v_equipement.numero_serie,
    'date_mise_service', v_equipement.date_mise_service,
    'date_fin_garantie', v_equipement.date_fin_garantie,
    'garantie_active', v_garantie_active,
    'revenu_journalier_estime', v_equipement.revenu_journalier_estime,
    'statut_equipement', v_equipement.statut_equipement,
    'zone', v_zone_nom,
    'parc_nom', COALESCE(v_parc.nom, ''),
    'parc_code', COALESCE(v_parc.code, ''),
    'declare_le', NEW.declare_le,
    'declare_par_nom', v_declarant_nom
  );


  v_project_url := 'https://xhpykmhbahiikqbzwfkc.supabase.co';

  v_anon_key := current_setting('supabase.anon_key', true);


  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';

  END IF;


  SELECT net.http_post(
    url := v_project_url || '/functions/v1/notify-arcade-incident',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := v_payload,
    timeout_milliseconds := 30000
  ) INTO v_request_id;


  RETURN NEW;

END;

$$;

;
