-- Nouvelle demande prestataire (spécifique ou d'intervention) : le chef
-- d'équipe est prévenu par une notification dans l'application et par mail
-- (fonction notifier-demande-prestataire), sauf s'il l'a créée lui-même.

ALTER TABLE public.demandes_prestataires ADD COLUMN IF NOT EXISTS email_envoye_le timestamptz;

CREATE OR REPLACE FUNCTION public.fn_notifier_demande_prestataire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_project_url text := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
  v_parc text;
  v_auteur text;
  v_titre text;
  v_chef record;
BEGIN
  SELECT code INTO v_parc FROM parcs WHERE id = NEW.parc_id;
  SELECT trim(prenom || ' ' || nom) INTO v_auteur FROM utilisateurs WHERE id = NEW.cree_par_id;
  v_titre := CASE WHEN NEW.urgente THEN 'URGENT · ' ELSE '' END
             || CASE NEW.type WHEN 'specifique' THEN 'Demande spécifique' ELSE 'Demande d''intervention' END
             || COALESCE(' · ' || v_parc, '');

  FOR v_chef IN
    SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.actif AND r.code = 'chef_maintenance' AND u.id IS DISTINCT FROM NEW.cree_par_id
  LOOP
    PERFORM notifier_push(v_chef.id, v_titre,
      NEW.objet || COALESCE(' · ' || NEW.prestataire, '') || COALESCE(' · par ' || v_auteur, ''),
      '/gmao/demandes-prestataires');
  END LOOP;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/notifier-demande-prestataire',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object('demande_id', NEW.id),
    timeout_milliseconds := 30000
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_notifier_demande_prestataire() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER demandes_prestataires_notifier AFTER INSERT ON public.demandes_prestataires
  FOR EACH ROW EXECUTE FUNCTION fn_notifier_demande_prestataire();
