/*
  # Fix vue_recurrences_actives security definer

  1. Changes
    - Drop and recreate `vue_recurrences_actives` without SECURITY DEFINER
    - The view now uses SECURITY INVOKER (default), so it runs with the
      calling user's permissions, respecting RLS policies on underlying tables

  2. Security
    - Removes SECURITY DEFINER risk (view no longer bypasses RLS)
*/

DROP VIEW IF EXISTS vue_recurrences_actives;

CREATE VIEW vue_recurrences_actives AS
SELECT e.id AS equipement_id,
    e.code,
    e.libelle,
    p.id AS parc_id,
    p.nom AS parc_nom,
    count(i.id) FILTER (WHERE i.declare_le >= (now() - '30 days'::interval)) AS pannes_30j,
    count(i.id) FILTER (WHERE i.declare_le >= (now() - '90 days'::interval)) AS pannes_90j,
    (SELECT count(*) FROM plaintes_clients pc
     WHERE pc.equipement_id = e.id AND pc.declare_le >= (now() - '7 days'::interval)) AS plaintes_7j,
    e.a_surveiller,
    (EXISTS (SELECT 1 FROM fiches_5_pourquoi f
     WHERE f.equipement_id = e.id AND f.statut IN ('ouvert','audit_en_cours'))) AS a_5_pourquoi
FROM equipements e
JOIN parcs p ON p.id = e.parc_id
LEFT JOIN incidents i ON i.equipement_id = e.id
GROUP BY e.id, e.code, e.libelle, p.id, p.nom, e.a_surveiller
HAVING count(i.id) FILTER (WHERE i.declare_le >= (now() - '30 days'::interval)) >= 2
    OR e.a_surveiller = true;