-- Réserve le mail d'un rappel « appeler le client » (un seul mail par rappel du
-- cron, et seulement dans l'heure qui suit ce rappel). Réservée à l'edge function.
CREATE OR REPLACE FUNCTION public.reserver_mail_rappel_appel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_d record;
BEGIN
  UPDATE declarations_blesses d
     SET appel_rappel_mail_le = now()
   WHERE d.id = p_id AND d.niveau = 3 AND d.supprime_le IS NULL AND d.client_appele_le IS NULL
     AND d.appel_dernier_rappel > now() - interval '1 hour'
     AND (d.appel_rappel_mail_le IS NULL OR d.appel_rappel_mail_le < d.appel_dernier_rappel)
  RETURNING d.* INTO v_d;
  IF v_d.id IS NULL THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_d) || jsonb_build_object('parc_nom', (SELECT nom FROM parcs WHERE id = v_d.parc_id));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.reserver_mail_rappel_appel(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserver_mail_rappel_appel(uuid) TO service_role;