-- Horaires des parcs calés sur Google chaque matin (fonction
-- sync-horaires-google ; nécessite le secret GOOGLE_PLACES_API_KEY).
SELECT cron.schedule(
  'gmao_sync_horaires_google',
  '40 4 * * *',
  $$SELECT net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/sync-horaires-google',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)$$
);
