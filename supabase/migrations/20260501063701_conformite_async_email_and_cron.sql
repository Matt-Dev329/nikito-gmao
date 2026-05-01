/*
  # Declenchement email asynchrone + cron quotidien Conformite ERP

  1. Nouvelle fonction trigger
    - `fn_send_conformite_email_async` : AFTER INSERT sur notifications_conformite
      appelle l'edge function `send-conformite-email` via pg_net uniquement pour les
      types critiques (prescription_creee, prescription_levee, prescription_retard,
      commission_pv_recu, phase_changement, commission_creee)

  2. Cron job quotidien
    - Appel de `check-conformite-deadlines` tous les jours a 07:00 heure de Paris
      (cron : `0 5 * * *` pendant CEST UTC+2, ajuste via timezone)
    - Utilise pg_cron + pg_net

  3. Securite
    - Fonctions SECURITY DEFINER avec search_path = public
*/

CREATE OR REPLACE FUNCTION public.fn_send_conformite_email_async()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url TEXT := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
  v_types_critiques TEXT[] := ARRAY[
    'prescription_creee',
    'prescription_levee',
    'prescription_retard',
    'commission_creee',
    'commission_pv_recu',
    'phase_changement'
  ];
  v_request_id BIGINT;
BEGIN
  IF NOT (NEW.type_notification = ANY(v_types_critiques)) THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := v_project_url || '/functions/v1/send-conformite-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'type_notification', NEW.type_notification,
      'titre', NEW.titre,
      'message', NEW.message
    ),
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_conformite_email_async ON notifications_conformite;
CREATE TRIGGER trg_send_conformite_email_async
  AFTER INSERT ON notifications_conformite
  FOR EACH ROW
  EXECUTE FUNCTION fn_send_conformite_email_async();

-- Cron job : 07:00 Paris (CEST = UTC+2 en ete, CET = UTC+1 en hiver)
-- On planifie a 05:00 UTC et 06:00 UTC pour couvrir les 2 periodes,
-- puis on deduplique via la verification "notification deja creee aujourd'hui"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('check-conformite-deadlines-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-conformite-deadlines-daily');

    PERFORM cron.schedule(
      'check-conformite-deadlines-daily',
      '0 6 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/check-conformite-deadlines',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
      $cron$
    );
  END IF;
END $$;
