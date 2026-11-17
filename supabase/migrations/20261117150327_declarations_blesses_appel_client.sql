-- Blessés niveau 3 : « Client appelé » à valider. Tant que ce n'est pas fait,
-- rappel tous les 3 jours (notification + mail) au chef d'équipe, aux
-- directeurs et aux managers principaux du parc.
ALTER TABLE public.declarations_blesses
  ADD COLUMN client_appele_le timestamptz,
  ADD COLUMN client_appele_par_id uuid REFERENCES public.utilisateurs(id),
  ADD COLUMN client_appele_par_nom text,
  ADD COLUMN client_appel_note text,
  ADD COLUMN appel_dernier_rappel timestamptz,
  ADD COLUMN appel_rappel_mail_le timestamptz;
CREATE INDEX declarations_blesses_client_appele_par_idx ON public.declarations_blesses(client_appele_par_id);

CREATE OR REPLACE FUNCTION public.valider_appel_client_blesse(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_parc uuid;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  SELECT parc_id INTO v_parc FROM declarations_blesses WHERE id = p_id AND supprime_le IS NULL FOR UPDATE;
  IF v_parc IS NULL THEN
    RAISE EXCEPTION 'Déclaration introuvable';
  END IF;
  IF NOT acces_registre_blesses(v_parc) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  UPDATE declarations_blesses
     SET client_appele_le = now(),
         client_appele_par_id = v_moi,
         client_appele_par_nom = (SELECT trim(prenom || ' ' || nom) FROM utilisateurs WHERE id = v_moi),
         client_appel_note = nullif(left(trim(coalesce(p_note, '')), 1000), '')
   WHERE id = p_id AND client_appele_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appel déjà validé';
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.valider_appel_client_blesse(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valider_appel_client_blesse(uuid, text) TO authenticated;

-- Rappels (pg_cron, chaque matin) : niveau 3, client pas encore appelé,
-- dernier rappel (ou déclaration) il y a 3 jours ou plus.
CREATE OR REPLACE FUNCTION public.rappels_appel_client_blesses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_d record;
  v_dest record;
  v_jours int;
  v_n int := 0;
BEGIN
  FOR v_d IN
    SELECT d.*, p.code AS parc_code
    FROM declarations_blesses d JOIN parcs p ON p.id = d.parc_id
    WHERE d.niveau = 3 AND d.supprime_le IS NULL AND d.client_appele_le IS NULL
      AND coalesce(d.appel_dernier_rappel, d.declare_le) <= now() - interval '3 days' + interval '2 hours'
    FOR UPDATE OF d SKIP LOCKED
  LOOP
    v_jours := greatest(1, (now()::date - v_d.declare_le::date));
    UPDATE declarations_blesses SET appel_dernier_rappel = now() WHERE id = v_d.id;
    FOR v_dest IN SELECT utilisateur_id FROM destinataires_mise_a_jour(v_d.parc_id) LOOP
      PERFORM notifier_push(v_dest.utilisateur_id,
        '📞 Rappeler le client · ' || v_d.numero,
        v_d.parc_code || ' · ' || coalesce(v_d.victime_prenom, '') || ' ' || coalesce(v_d.victime_nom, '')
          || ' (blessé niveau 3, il y a ' || v_jours || ' j). Valide « Client appelé » une fois fait.',
        '/gmao/blesses');
    END LOOP;
    BEGIN
      PERFORM net.http_post(
        url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/notifier-blesse',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
        body := jsonb_build_object('id', v_d.id, 'rappel_appel', true),
        timeout_milliseconds := 30000);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rappels_appel_client_blesses() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('gmao_rappels_appel_client_blesses', '35 7 * * *', 'SELECT public.rappels_appel_client_blesses()');