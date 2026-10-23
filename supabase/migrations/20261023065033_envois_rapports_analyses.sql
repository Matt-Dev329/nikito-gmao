-- Envoi par mail d'un rapport des analyses prestataires (défauts + PDF joints)
-- à des membres de l'équipe. Une demande = une ligne ; le trigger appelle
-- l'edge function envoyer-rapport-analyses, qui ne fait confiance qu'à la
-- base (seules les demandes « a_envoyer » partent, une seule fois).
-- Demande réservée au chef d'équipe, à la direction et à l'admin IT.

CREATE TABLE public.envois_rapports_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_ids uuid[] NOT NULL CHECK (cardinality(document_ids) BETWEEN 1 AND 30),
  destinataire_ids uuid[] NOT NULL CHECK (cardinality(destinataire_ids) BETWEEN 1 AND 30),
  urgent boolean NOT NULL DEFAULT false,
  message text CHECK (length(message) <= 2000),
  statut text NOT NULL DEFAULT 'a_envoyer' CHECK (statut IN ('a_envoyer', 'en_cours', 'envoye', 'erreur')),
  erreur text,
  demande_par_id uuid REFERENCES public.utilisateurs(id) DEFAULT current_utilisateur_id(),
  cree_le timestamptz NOT NULL DEFAULT now(),
  envoye_le timestamptz
);
CREATE INDEX envois_rapports_analyses_demande_par_idx ON public.envois_rapports_analyses (demande_par_id);

ALTER TABLE public.envois_rapports_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY envois_rapports_analyses_insert ON public.envois_rapports_analyses
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT current_role_code())::text IN ('chef_maintenance', 'direction', 'admin_it')
              AND statut = 'a_envoyer'
              AND demande_par_id = (SELECT current_utilisateur_id()));

CREATE POLICY envois_rapports_analyses_select ON public.envois_rapports_analyses
  FOR SELECT TO authenticated
  USING ((SELECT current_role_code())::text IN ('chef_maintenance', 'direction', 'admin_it'));

GRANT SELECT, INSERT ON public.envois_rapports_analyses TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_envoyer_rapport_analyses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/envoyer-rapport-analyses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
    body := jsonb_build_object('envoi_id', NEW.id),
    timeout_milliseconds := 60000
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_envoyer_rapport_analyses() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_envoyer_rapport_analyses
AFTER INSERT ON public.envois_rapports_analyses
FOR EACH ROW EXECUTE FUNCTION public.fn_envoyer_rapport_analyses();
