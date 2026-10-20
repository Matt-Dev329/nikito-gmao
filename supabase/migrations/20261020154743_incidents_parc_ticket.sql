-- Parc d'un ticket pour l'affichage et les filtres de l'appli : parc de
-- l'équipement, ou à défaut parc du déclarant (ticket signalé avec un
-- équipement saisi à la main). Même règle que parcs_du_ticket (validation).
-- Champs calculés lisibles par l'API : incidents.parc_ticket / parc_ticket_code.

CREATE OR REPLACE FUNCTION public.parc_ticket(i public.incidents)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT (parcs_du_ticket(i.id))[1];
$function$;

CREATE OR REPLACE FUNCTION public.parc_ticket_code(i public.incidents)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.code FROM parcs p WHERE p.id = (parcs_du_ticket(i.id))[1];
$function$;

REVOKE ALL ON FUNCTION public.parc_ticket(public.incidents) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parc_ticket_code(public.incidents) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parc_ticket(public.incidents) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parc_ticket_code(public.incidents) TO authenticated;
