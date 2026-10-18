-- Spécialités des techniciens + notifications « ticket à valider » / « nouveau ticket ».
--  * utilisateurs.specialites : catégories d'équipement suivies (vide = toutes).
--    Un technicien spécialisé ne voit que les tickets de ses catégories
--    (et ceux qui lui sont assignés), et n'est notifié que pour eux.
--  * trg_notifier_ticket_cree : appelle la fonction notifier-ticket quand un
--    ticket est en attente de validation ou arrive dans Opérations.

ALTER TABLE public.utilisateurs ADD COLUMN IF NOT EXISTS specialites uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.current_specialites()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((SELECT specialites FROM utilisateurs WHERE auth_user_id = (SELECT auth.uid())), '{}'::uuid[]);
$function$;
REVOKE ALL ON FUNCTION public.current_specialites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_specialites() TO authenticated;

ALTER POLICY inc_direction_total ON public.incidents
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND ((equipement_id IN (SELECT e.id FROM equipements e
                                     WHERE e.parc_id = ANY (current_parc_ids())
                                       AND (cardinality((SELECT current_specialites())) = 0
                                            OR e.categorie_id = ANY (current_specialites()))))
                  OR (assigne_a_id = (SELECT current_utilisateur_id()))
                  OR ((equipement_id IS NULL)
                      AND cardinality((SELECT current_specialites())) = 0
                      AND ((declare_par_id = (SELECT current_utilisateur_id()))
                           OR (parcs_de_utilisateur(declare_par_id) && current_parc_ids()))))));

-- Lili-Marie Pellerin : technicienne arcade uniquement
UPDATE public.utilisateurs
SET specialites = ARRAY['528abb79-8a0d-4d9e-9cad-146565b2dc43'::uuid]
WHERE id = 'e16778f6-e129-4f8b-9c86-2761c2616526';

CREATE OR REPLACE FUNCTION public.fn_notifier_ticket_cree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(NEW.est_formation, false) OR coalesce(NEW.est_brouillon, false) OR NEW.statut = 'annule' THEN
    RETURN NEW;
  END IF;
  IF NEW.validation_manager NOT IN ('en_attente', 'auto', 'valide') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.validation_manager IS NOT DISTINCT FROM OLD.validation_manager
     AND coalesce(NEW.est_brouillon, false) = coalesce(OLD.est_brouillon, false) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/notifier-ticket',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
      body := jsonb_build_object('incident_id', NEW.id),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN OTHERS THEN
    -- La notification ne doit jamais bloquer la création d'un ticket
    NULL;
  END;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_notifier_ticket_cree() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notifier_ticket_cree
  AFTER INSERT OR UPDATE OF validation_manager, est_brouillon ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_notifier_ticket_cree();
