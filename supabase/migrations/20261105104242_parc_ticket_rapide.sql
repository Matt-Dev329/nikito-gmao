-- Parc d'un ticket (colonnes calculées parc_ticket / parc_ticket_code,
-- utilisées partout pour filtrer par parc) : calculé directement depuis la
-- ligne (équipement, meta.parc_id, parcs du déclarant) au lieu de relire le
-- ticket trois fois via parcs_du_ticket. Même résultat (vérifié sur tous les
-- tickets), requêtes de la liste des tickets bien plus rapides (elles
-- dépassaient le délai maximal).
CREATE OR REPLACE FUNCTION public.parc_de_ticket(p_equipement_id uuid, p_meta jsonb, p_declare_par_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT (coalesce(
    (SELECT ARRAY[e.parc_id] FROM equipements e WHERE e.id = p_equipement_id),
    -- Parc indiqué à la création (ticket sans équipement, ex. défaut de rapport prestataire)
    (SELECT ARRAY[p.id] FROM parcs p WHERE p.id::text = p_meta->>'parc_id'),
    parcs_de_utilisateur(p_declare_par_id),
    '{}'::uuid[]))[1];
$function$;

REVOKE EXECUTE ON FUNCTION public.parc_de_ticket(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parc_de_ticket(uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.parc_ticket(i incidents)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT parc_de_ticket(i.equipement_id, i.meta, i.declare_par_id);
$function$;

CREATE OR REPLACE FUNCTION public.parc_ticket_code(i incidents)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.code FROM parcs p WHERE p.id = parc_de_ticket(i.equipement_id, i.meta, i.declare_par_id);
$function$;