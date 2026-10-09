/*
  # Récurrences : retrait automatique du marquage « à surveiller »

  Le trigger `check_recurrence` passe `equipements.a_surveiller` à true dès
  3 pannes en 30 jours, mais rien ne le remettait à false : des équipements
  sans panne depuis des mois restaient comptés comme récurrences (badge +
  page Récurrences).

  - `fn_retirer_surveillance_sans_panne()` : remet a_surveiller à false pour
    les équipements sans aucun incident déclaré depuis 30 jours.
  - Cron quotidien `gmao_retrait_surveillance` à 03:50 UTC.
  - Exécution immédiate une fois pour nettoyer l'existant.
*/

CREATE OR REPLACE FUNCTION public.fn_retirer_surveillance_sans_panne()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_nb integer;
BEGIN
  UPDATE equipements e
  SET a_surveiller = false
  WHERE e.a_surveiller
    AND NOT EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.equipement_id = e.id
        AND i.declare_le >= now() - interval '30 days'
    );
  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_retirer_surveillance_sans_panne() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'gmao_retrait_surveillance',
  '50 3 * * *',
  $cron$ SELECT public.fn_retirer_surveillance_sans_panne(); $cron$
);

SELECT public.fn_retirer_surveillance_sans_panne();
