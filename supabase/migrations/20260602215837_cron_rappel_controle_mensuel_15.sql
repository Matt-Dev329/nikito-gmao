/*
  # Cron rappel controle mensuel le 15 de chaque mois

  1. Schedule
    - Job pg_cron `rappel-controle-mensuel-15` planifie a 09:00 Paris (07:00 UTC)
      le 15 de chaque mois
    - Cron expression: `0 7 15 * *`
    - Appelle l'edge function `rappel-controle-mensuel` via pg_net
      qui envoie un email aux techniciens et managers concernes
      pour les parcs ou le controle mensuel n'est pas encore valide ce mois

  2. Notes
    - L'edge function est verify_jwt=false (cron public via Bearer anon)
    - Si pg_cron n'est pas installe, le bloc est ignore
    - Si le job existe deja, il est unschedule puis recree
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('rappel-controle-mensuel-15')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rappel-controle-mensuel-15');


    PERFORM cron.schedule(
      'rappel-controle-mensuel-15',
      '0 7 15 * *',
      $cron$
      SELECT net.http_post(
        url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/rappel-controle-mensuel',
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

;
