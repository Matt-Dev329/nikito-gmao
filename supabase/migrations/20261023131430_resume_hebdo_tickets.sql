-- Résumé du lundi au chef d'équipe (tickets ouverts / en retard par parc,
-- plus anciens, pièces attendues) : edge function resume-hebdo-tickets
-- appelée chaque lundi à 6 h UTC (7 h ou 8 h à Paris). Une ligne par semaine
-- envoyée, pour ne jamais envoyer deux fois le même résumé.

CREATE TABLE public.resumes_hebdo_tickets (
  semaine date PRIMARY KEY,
  envoye_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resumes_hebdo_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resumes_hebdo_tickets FROM anon, authenticated;

SELECT cron.schedule(
  'gmao_resume_hebdo_tickets',
  '0 6 * * 1',
  $$SELECT net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/resume-hebdo-tickets',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)$$
);
