-- Bilan de la semaine (tickets, interventions, contrôles, commandes, stock,
-- prestataires, contrats, équipe) envoyé au chef d'équipe chaque lundi :
-- le job du lundi appelle désormais l'edge function bilan-hebdo, qui
-- remplace le résumé des seuls tickets. Une ligne par semaine envoyée.

CREATE TABLE public.bilans_hebdo (
  semaine date PRIMARY KEY,
  envoye_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bilans_hebdo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bilans_hebdo FROM anon, authenticated;

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'gmao_resume_hebdo_tickets'),
  command := $$SELECT net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/bilan-hebdo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)$$
);
