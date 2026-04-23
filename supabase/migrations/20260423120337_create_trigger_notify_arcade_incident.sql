/*
  # Notification automatique incidents arcade

  1. Nouvelle fonction trigger
    - `fn_notify_arcade_incident()` : detecte si un nouvel incident concerne un equipement
      de categorie "Arcade . borne" et appelle l'edge function `notify-arcade-incident`
      via pg_net pour envoyer un email a joachim.miloche@ja-fg.com

  2. Nouveau trigger
    - `trg_notify_arcade_incident` sur INSERT dans `incidents`
    - Se declenche AFTER INSERT FOR EACH ROW
    - Ne se declenche PAS pour les donnees de formation (est_formation = true)

  3. Securite
    - La fonction est SECURITY DEFINER pour acceder a pg_net
    - search_path fixe a public pour eviter les attaques par search_path
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
  v_categorie_nom TEXT;
  v_priorite_nom TEXT;
  v_declarant_nom TEXT;
  v_payload JSONB;
  v_project_url TEXT;
  v_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Ne pas notifier pour les donnees de formation
  IF NEW.est_formation THEN
    RETURN NEW;
  END IF;

  -- Recuperer l'equipement et sa categorie
  SELECT e.code, e.libelle, e.parc_id, ce.nom AS categorie_nom
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
  SELECT (prenom || ' ' || nom) INTO v_declarant_nom
  FROM utilisateurs WHERE id = NEW.declare_par_id;

  -- Construire le payload
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
    'parc_nom', COALESCE(v_parc.nom, ''),
    'parc_code', COALESCE(v_parc.code, ''),
    'declare_le', NEW.declare_le,
    'declare_par_nom', v_declarant_nom
  );

  -- Appeler l'edge function via pg_net
  v_project_url := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key := current_setting('supabase.anon_key', true);

  -- Fallback si le setting n'est pas disponible (utiliser la clé connue du projet)
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

-- Creer le trigger (le supprimer d'abord s'il existe)
DROP TRIGGER IF EXISTS trg_notify_arcade_incident ON incidents;

CREATE TRIGGER trg_notify_arcade_incident
  AFTER INSERT ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_arcade_incident();
