-- Blessés : un mail à chaque déclaration (chef d'équipe, directeurs et
-- managers principaux du parc), envoyé par l'edge function notifier-blesse.
ALTER TABLE public.declarations_blesses ADD COLUMN mail_envoye_le timestamptz;

CREATE OR REPLACE FUNCTION public.fn_notifier_blesse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/notifier-blesse',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := jsonb_build_object('id', NEW.id),
      timeout_milliseconds := 30000);
  EXCEPTION WHEN OTHERS THEN
    -- Le mail ne doit jamais bloquer la déclaration
    NULL;
  END;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_notifier_blesse() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notifier_blesse AFTER INSERT ON public.declarations_blesses
  FOR EACH ROW EXECUTE FUNCTION fn_notifier_blesse();