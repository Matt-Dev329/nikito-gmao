-- ============================================================================
-- m7_vue_dernieres_positions_vehicules
-- ----------------------------------------------------------------------------
-- Vue optimisée : 1 ligne par véhicule, sa dernière position connue.
-- Remplace le pattern N+1 du hook useDernieresPositions (1 query par véhicule).
-- 
-- Performance :
--   AVANT : N véhicules => N+1 queries séquentielles (1 pour la liste + 1 par véhicule)
--   APRÈS : 1 seule query, DISTINCT ON Postgres natif
--
-- Sécurité : SECURITY INVOKER => hérite des RLS de vehicules_positions
-- (Direction + Chef maintenance peuvent lire, conformément aux politiques actives)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_vehicules_dernieres_positions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (vp.vehicule_id)
  vp.id,
  vp.vehicule_id,
  vp.latitude,
  vp.longitude,
  vp.vitesse,
  vp.cap,
  vp.altitude,
  vp.batterie_tracker,
  vp.moteur_allume,
  vp.adresse,
  vp.enregistre_le
FROM public.vehicules_positions vp
ORDER BY vp.vehicule_id, vp.enregistre_le DESC;

COMMENT ON VIEW public.v_vehicules_dernieres_positions IS
  'Dernière position connue par véhicule. Une seule ligne par vehicule_id. Performant via DISTINCT ON. SECURITY INVOKER : hérite des RLS de vehicules_positions.';;
