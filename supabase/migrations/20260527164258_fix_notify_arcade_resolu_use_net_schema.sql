/*
  # Fix: utiliser net.http_post au lieu de extensions.http_post

  Correction du schema de pg_net pour la fonction fn_notify_arcade_incident_resolu.
  Le trigger existant (creation incident) utilise net.http_post.
*/

CREATE OR REPLACE FUNCTION public.fn_notify_arcade_incident_resolu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipement RECORD;
  v_parc RECORD;
  v_categorie_nom TEXT;
  v_priorite_nom TEXT;
  v_resolu_par_nom TEXT;
  v_declare_par_nom TEXT;
  v_duree_min INTEGER;
  v_payload JSONB;
  v_project_url TEXT;
  v_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Ne notifier que pour les transitions vers resolu
  IF OLD.statut = 'resolu' OR NEW.statut != 'resolu' THEN
    RETURN NEW;
  END IF;

  -- Ne pas notifier pour les donnees de formation
  IF NEW.est_formation THEN
    RETURN NEW;
  END IF;

  -- Recuperer l'equipement et sa categorie
  SELECT e.code, e.libelle, e.parc_id, e.numero_reader, e.numero_serie, ce.nom AS categorie_nom
  INTO v_equipement
  FROM equipements e
  JOIN categories_equipement ce ON ce.id = e.categorie_id
  WHERE e.id = NEW.equipement_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Verifier que c'est un equipement arcade
  IF v_equipement.categorie_nom NOT ILIKE '%arcade%' THEN
    RETURN NEW;
  END IF;

  -- Recuperer le parc
  SELECT code, nom INTO v_parc
  FROM parcs WHERE id = v_equipement.parc_id;

  -- Recuperer la priorite
  SELECT nom INTO v_priorite_nom
  FROM niveaux_priorite WHERE id = NEW.priorite_id;

  -- Recuperer le nom du declarant
  SELECT (prenom || ' ' || nom) INTO v_declare_par_nom
  FROM utilisateurs WHERE id = NEW.declare_par_id;

  -- Recuperer le nom de qui a resolu
  SELECT (prenom || ' ' || nom) INTO v_resolu_par_nom
  FROM utilisateurs WHERE id = NEW.resolu_par_id;

  -- Calculer la duree de panne en minutes
  IF NEW.resolu_le IS NOT NULL AND NEW.declare_le IS NOT NULL THEN
    v_duree_min := EXTRACT(EPOCH FROM (NEW.resolu_le - NEW.declare_le)) / 60;
  ELSE
    v_duree_min := NULL;
  END IF;

  -- Construire le payload
  v_payload := jsonb_build_object(
    'incident_id', NEW.id,
    'numero_bt', NEW.numero_bt,
    'titre', NEW.titre,
    'description', NEW.description,
    'equipement_code', v_equipement.code,
    'equipement_libelle', v_equipement.libelle,
    'numero_reader', v_equipement.numero_reader,
    'numero_serie', v_equipement.numero_serie,
    'categorie_nom', v_equipement.categorie_nom,
    'parc_nom', COALESCE(v_parc.nom, ''),
    'parc_code', COALESCE(v_parc.code, ''),
    'priorite', COALESCE(v_priorite_nom, 'Non definie'),
    'declare_le', NEW.declare_le,
    'declare_par_nom', v_declare_par_nom,
    'resolu_le', NEW.resolu_le,
    'resolu_par_nom', v_resolu_par_nom,
    'duree_minutes', v_duree_min
  );

  -- Appeler l'edge function via pg_net
  v_project_url := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key := current_setting('supabase.anon_key', true);

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
  END IF;

  SELECT net.http_post(
    url := v_project_url || '/functions/v1/notify-arcade-incident-resolu',
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
