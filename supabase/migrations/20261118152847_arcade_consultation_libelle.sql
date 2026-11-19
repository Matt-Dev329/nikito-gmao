-- Rôle consultation_arcade renommé « Arcade consultation » (plus de « Staff Arcade »)
UPDATE public.roles SET nom = 'Arcade consultation' WHERE code = 'consultation_arcade';

CREATE OR REPLACE FUNCTION public.bloquer_ancienne_adresse()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entetes json;
  v_methode text;
  v_chemin text;
  v_role text;
BEGIN
  BEGIN
    v_entetes := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_entetes := NULL;
  END;
  IF v_entetes IS NOT NULL
     AND (coalesce(v_entetes->>'origin', '') ILIKE '%bolt.host%'
          OR coalesce(v_entetes->>'referer', '') ILIKE '%bolt.host%') THEN
    RAISE EXCEPTION 'ALBA a déménagé : utilise https://nikito.tech'
      USING ERRCODE = '42501', HINT = 'https://nikito.tech';
  END IF;

  -- Arcade consultation : lecture seule
  v_methode := upper(coalesce(nullif(current_setting('request.method', true), ''), 'GET'));
  IF v_methode IN ('GET', 'HEAD', 'OPTIONS') THEN
    RETURN;
  END IF;
  BEGIN
    v_role := current_role_code()::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF v_role IS DISTINCT FROM 'consultation_arcade' THEN
    RETURN;
  END IF;
  v_chemin := coalesce(current_setting('request.path', true), '');
  IF v_chemin ~ '(^|/)(rpc/)?(tickets_arcade_consultation|verifier_device_reconnu|rafraichir_device|verifier_code_2fa|enregistrer_device|accepter_invitation|supprimer_devices_utilisateur_courant|enregistrer_abonnement_push|desactiver_abonnement_push|codes_2fa)/?$' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Compte Arcade consultation : lecture seule' USING ERRCODE = '42501';
END;
$function$;