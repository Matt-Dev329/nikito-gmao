-- Analyse anti-doublon de chaque nouveau ticket : à la création (ou quand un
-- brouillon devient un vrai ticket), la base appelle la fonction
-- analyser-doublon-ticket, qui refuse automatiquement un ticket qui reprend
-- le même problème qu'un ticket déjà en cours du même parc.
CREATE OR REPLACE FUNCTION public.fn_analyser_doublon_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(NEW.est_formation, false) OR coalesce(NEW.est_brouillon, false)
     OR NEW.statut NOT IN ('ouvert', 'assigne', 'en_cours', 'en_pause') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.est_brouillon, false) = false THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/analyser-doublon-ticket',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := jsonb_build_object('incident_id', NEW.id),
      timeout_milliseconds := 60000
    );
  EXCEPTION WHEN OTHERS THEN
    -- L'analyse ne doit jamais bloquer la création d'un ticket
    NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_analyser_doublon_ticket() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_analyser_doublon_ticket
  AFTER INSERT OR UPDATE OF est_brouillon ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION fn_analyser_doublon_ticket();