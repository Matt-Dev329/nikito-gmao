-- L'ancienne adresse Bolt (*.bolt.host) sert une vieille version d'ALBA qui
-- n'est plus mise à jour : toute requête API venant de là est refusée avec un
-- message qui renvoie vers nikito.tech.
CREATE OR REPLACE FUNCTION public.bloquer_ancienne_adresse()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entetes json;
BEGIN
  BEGIN
    v_entetes := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF v_entetes IS NOT NULL
     AND (coalesce(v_entetes->>'origin', '') ILIKE '%bolt.host%'
          OR coalesce(v_entetes->>'referer', '') ILIKE '%bolt.host%') THEN
    RAISE EXCEPTION 'ALBA a déménagé : utilise https://nikito.tech'
      USING ERRCODE = '42501', HINT = 'https://nikito.tech';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bloquer_ancienne_adresse() TO anon, authenticated;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.bloquer_ancienne_adresse';
NOTIFY pgrst, 'reload config';
