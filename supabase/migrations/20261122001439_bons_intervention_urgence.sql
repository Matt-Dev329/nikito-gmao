-- Bon d'intervention marqué « urgence » (même bon qu'un bon normal) : heure
-- de la panne / de l'appel et fin d'intervention en plus. Réservé à Ryad
-- (acces_tableau_de_bord), contrôlé à l'enregistrement.
ALTER TABLE public.bons_intervention
  ADD COLUMN est_urgence boolean NOT NULL DEFAULT false,
  ADD COLUMN heure_panne timestamptz,
  ADD COLUMN fin_intervention timestamptz;

CREATE OR REPLACE FUNCTION public.fn_bons_intervention_urgence_reservee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.est_urgence
     AND (TG_OP = 'INSERT' OR NOT OLD.est_urgence)
     AND current_utilisateur_id() IS NOT NULL
     AND NOT acces_tableau_de_bord() THEN
    RAISE EXCEPTION 'Bon d''urgence réservé' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_bons_intervention_urgence BEFORE INSERT OR UPDATE ON public.bons_intervention
  FOR EACH ROW EXECUTE FUNCTION fn_bons_intervention_urgence_reservee();