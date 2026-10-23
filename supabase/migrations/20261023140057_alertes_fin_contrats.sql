-- Alertes de fin de contrat prestataire (60 puis 30 jours avant la fin) :
-- edge function alertes-fin-contrats appelée chaque jour à 6 h 20 UTC ; une
-- ligne par contrat et par palier envoyé, pour ne jamais envoyer deux fois.

CREATE TABLE public.alertes_contrats_envoyees (
  document_id uuid NOT NULL REFERENCES public.documents_techniques(id) ON DELETE CASCADE,
  palier integer NOT NULL CHECK (palier IN (60, 30)),
  envoye_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, palier)
);
ALTER TABLE public.alertes_contrats_envoyees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alertes_contrats_envoyees FROM anon, authenticated;

SELECT cron.schedule(
  'gmao_alertes_fin_contrats',
  '20 6 * * *',
  $$SELECT net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/alertes-fin-contrats',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)$$
);
