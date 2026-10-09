/*
  # Récurrences : retrait automatique limité aux données réelles

  Le mode Formation repose sur des pannes fictives anciennes : le retrait
  automatique de « à surveiller » vidait ses récurrences de démonstration.
  - La fonction ne touche plus que les équipements réels (est_formation = false).
  - Restauration du marquage pour les équipements de formation : ceux du jeu
    de démonstration initial et ceux ayant une fiche 5 Pourquoi (le trigger
    check_recurrence les avait marqués ensemble).
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
    AND NOT e.est_formation
    AND NOT EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.equipement_id = e.id
        AND i.declare_le >= now() - interval '30 days'
    );
  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END;
$$;

UPDATE equipements e
SET a_surveiller = true
WHERE e.est_formation
  AND (
    e.id IN ('a0000001-0001-0001-0001-000000000002',
             'a0000001-0001-0001-0001-000000000009',
             'a0000001-0002-0001-0001-000000000002')
    OR EXISTS (SELECT 1 FROM fiches_5_pourquoi f WHERE f.equipement_id = e.id)
  );
