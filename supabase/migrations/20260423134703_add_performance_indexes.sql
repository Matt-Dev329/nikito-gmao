/*
  # Add performance indexes for critical query patterns

  1. New Indexes
    - `idx_controles_parc_date_type` — controles filtered by parc + date + type (historique, sidebar badges)
    - `idx_incidents_statut_date` — incidents filtered by statut + date (operations, KPI, interventions)
    - `idx_incidents_equipement_date` — incidents per equipement (IA predictive, recurrences)
    - `idx_hypotheses_ia_formation_statut` — hypotheses IA aggregation (sidebar badges, notifications)
    - `idx_controle_items_controle_etat` — controle items by controle + etat (detail views)
    - `idx_interventions_incident_debut` — interventions per incident sorted by date (suivi)
    - `idx_equipements_parc_statut` — equipements per parc (equipements page, IA data)
    - `idx_plaintes_formation_statut` — plaintes by statut (sidebar badge count)
  2. Notes
    - All indexes use IF NOT EXISTS for safe re-runs
    - Partial indexes with WHERE est_formation = false target production data
    - Expected to reduce latency on dashboard and KPI queries significantly
*/

CREATE INDEX IF NOT EXISTS idx_controles_parc_date_type
  ON controles (parc_id, date_planifiee DESC, type)
  WHERE est_formation = false;

CREATE INDEX IF NOT EXISTS idx_controles_parc_date_type_formation
  ON controles (parc_id, date_planifiee DESC, type)
  WHERE est_formation = true;

CREATE INDEX IF NOT EXISTS idx_incidents_statut_date
  ON incidents (statut, declare_le DESC)
  WHERE est_formation = false;

CREATE INDEX IF NOT EXISTS idx_incidents_equipement_date
  ON incidents (equipement_id, declare_le DESC)
  WHERE est_formation = false;

CREATE INDEX IF NOT EXISTS idx_hypotheses_ia_formation_statut
  ON hypotheses_ia (est_formation, statut, cree_le DESC);

CREATE INDEX IF NOT EXISTS idx_controle_items_controle_etat
  ON controle_items (controle_id, etat);

CREATE INDEX IF NOT EXISTS idx_interventions_incident_debut
  ON interventions (incident_id, debut DESC);

CREATE INDEX IF NOT EXISTS idx_equipements_parc_statut
  ON equipements (parc_id, statut)
  WHERE statut != 'archive';

CREATE INDEX IF NOT EXISTS idx_plaintes_formation_statut
  ON plaintes_clients (est_formation, statut);

CREATE INDEX IF NOT EXISTS idx_maintenances_prev_equipement
  ON maintenances_preventives (equipement_id, prochaine_echeance);
