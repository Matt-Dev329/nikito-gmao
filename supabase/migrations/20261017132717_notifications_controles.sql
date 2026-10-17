-- Notifications (appli + mail) des contrôles pour le chef d'équipe, les
-- directeurs de parc et les managers principaux (fonction notifier-controles) :
--  * contrôle quotidien ou hebdo validé → message « fait » ;
--  * contrôle quotidien non validé 30 min après l'ouverture → message « pas fait ».

-- Journal anti-doublon : un message par parc, type, date et événement
CREATE TABLE IF NOT EXISTS public.notifications_controles_envoyees (
  id bigserial PRIMARY KEY,
  parc_id uuid NOT NULL REFERENCES public.parcs(id),
  type text NOT NULL CHECK (type IN ('quotidien', 'hebdo')),
  date_controle date NOT NULL,
  evenement text NOT NULL CHECK (evenement IN ('fait', 'non_fait')),
  envoye_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parc_id, type, date_controle, evenement)
);
ALTER TABLE public.notifications_controles_envoyees ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_controles_lecture ON public.notifications_controles_envoyees
  FOR SELECT TO authenticated USING (acces_pilotage_parc(parc_id));

-- Appel de la fonction Edge (clé anon publique, comme notifier_push)
CREATE OR REPLACE FUNCTION public.appeler_notifier_controles(p_corps jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/notifier-controles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
    body := p_corps,
    timeout_milliseconds := 30000
  );
EXCEPTION WHEN OTHERS THEN
  -- La notification ne doit jamais bloquer la validation d'un contrôle
  NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.appeler_notifier_controles(jsonb) FROM PUBLIC, anon, authenticated;

-- Contrôle quotidien ou hebdo validé
CREATE OR REPLACE FUNCTION public.fn_notifier_controle_fait()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.statut = 'valide'
     AND NEW.type IN ('quotidien', 'hebdo')
     AND NOT coalesce(NEW.est_formation, false)
     AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut) THEN
    PERFORM appeler_notifier_controles(jsonb_build_object('mode', 'fait', 'controle_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notifier_controle_fait
  AFTER INSERT OR UPDATE OF statut ON public.controles
  FOR EACH ROW EXECUTE FUNCTION public.fn_notifier_controle_fait();

-- Contrôle quotidien pas fait : vérification toutes les 10 minutes
SELECT cron.schedule('gmao_alerte_controle_quotidien', '*/10 * * * *',
  $cron$SELECT appeler_notifier_controles('{"mode":"verifier"}'::jsonb)$cron$);