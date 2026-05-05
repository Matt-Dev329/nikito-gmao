/*
  # Vue optimisee des dernieres positions de vehicules

  1. Nouvelle vue
    - `v_vehicules_dernieres_positions` : retourne la derniere position connue
      de chaque vehicule en une seule requete (DISTINCT ON par vehicule_id,
      trie par enregistre_le DESC). Remplace le pattern N+1 du hook useFlotte.

  2. Securite
    - Vue definie avec `security_invoker = true` : les RLS de la table source
      `vehicules_positions` s'appliquent selon l'utilisateur appelant.
    - Aucune politique supplementaire requise (la vue herite des politiques
      de la table sous-jacente).
*/

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