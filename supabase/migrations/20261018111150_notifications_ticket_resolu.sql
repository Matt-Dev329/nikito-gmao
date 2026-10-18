-- Ticket résolu : notification dans l'appli + mail aux directeurs et managers
-- du parc (fonction notifier-ticket-resolu). Une seule fois par ticket.
CREATE TABLE public.notifications_tickets_envoyees (
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  evenement text NOT NULL,
  envoye_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, evenement)
);
ALTER TABLE public.notifications_tickets_envoyees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications_tickets_envoyees FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_notifier_ticket_resolu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.statut = 'resolu'
     AND OLD.statut IS DISTINCT FROM NEW.statut
     AND NOT coalesce(NEW.est_formation, false) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/notifier-ticket-resolu',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
        body := jsonb_build_object('incident_id', NEW.id),
        timeout_milliseconds := 30000
      );
    EXCEPTION WHEN OTHERS THEN
      -- La notification ne doit jamais bloquer la clôture d'un ticket
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_notifier_ticket_resolu() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notifier_ticket_resolu
  AFTER UPDATE OF statut ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_notifier_ticket_resolu();
