/*
  # Enrichir la notification arcade resolu avec les details de l'intervention

  1. Modification de la fonction trigger
    - `fn_notify_arcade_incident_resolu()` : ajoute au payload les donnees
      de la table `interventions` (diagnostic, actions_realisees, technicien,
      binome, resolu_premier_coup) et les pieces utilisees depuis
      `pieces_utilisees` + `pieces_detachees`

  2. Donnees ajoutees au payload
    - diagnostic (texte libre du technicien)
    - actions_realisees (description des reparations)
    - resolu_premier_coup (boolean)
    - technicien_nom (prenom + nom)
    - binome_nom (si present)
    - debut_intervention / fin_intervention
    - pieces_utilisees (array JSON avec nom, reference, quantite)
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
  v_intervention RECORD;
  v_priorite_nom TEXT;
  v_resolu_par_nom TEXT;
  v_declare_par_nom TEXT;
  v_technicien_nom TEXT;
  v_binome_nom TEXT;
  v_duree_min INTEGER;
  v_pieces JSONB;
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

  -- Recuperer l'intervention la plus recente pour cet incident
  SELECT i.diagnostic, i.actions_realisees, i.resolu_premier_coup,
         i.debut, i.fin, i.technicien_id, i.binome_id, i.id AS intervention_id
  INTO v_intervention
  FROM interventions i
  WHERE i.incident_id = NEW.id
  ORDER BY i.cree_le DESC
  LIMIT 1;

  -- Recuperer le nom du technicien de l'intervention
  IF v_intervention.technicien_id IS NOT NULL THEN
    SELECT (prenom || ' ' || nom) INTO v_technicien_nom
    FROM utilisateurs WHERE id = v_intervention.technicien_id;
  END IF;

  -- Recuperer le nom du binome si present
  IF v_intervention.binome_id IS NOT NULL THEN
    SELECT (prenom || ' ' || nom) INTO v_binome_nom
    FROM utilisateurs WHERE id = v_intervention.binome_id;
  END IF;

  -- Recuperer les pieces utilisees
  IF v_intervention.intervention_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'nom', pd.nom,
      'reference', pd.reference,
      'quantite', pu.quantite
    )), '[]'::jsonb)
    INTO v_pieces
    FROM pieces_utilisees pu
    JOIN pieces_detachees pd ON pd.id = pu.piece_id
    WHERE pu.intervention_id = v_intervention.intervention_id;
  ELSE
    v_pieces := '[]'::jsonb;
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
    'duree_minutes', v_duree_min,
    'diagnostic', v_intervention.diagnostic,
    'actions_realisees', v_intervention.actions_realisees,
    'resolu_premier_coup', v_intervention.resolu_premier_coup,
    'technicien_nom', v_technicien_nom,
    'binome_nom', v_binome_nom,
    'debut_intervention', v_intervention.debut,
    'fin_intervention', v_intervention.fin,
    'pieces_utilisees', v_pieces
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
