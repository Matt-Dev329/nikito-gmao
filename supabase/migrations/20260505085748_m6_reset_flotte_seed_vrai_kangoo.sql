-- ============================================================================
-- m6_reset_flotte_seed_vrai_kangoo
-- ----------------------------------------------------------------------------
-- Contexte : les tables vehicules / vehicules_positions contenaient
-- 5 véhicules fictifs et 4 positions de seed mock issus de tests Bolt.
-- Aucune donnée réelle à préserver.
--
-- Objectif :
--  1) Vider les positions et les véhicules fictifs
--  2) Insérer le SEUL véhicule réel : Renault Kangoo de la maintenance
--     équipé d'un tracker Copenhagen Trackers Gemstone (IMEI 860873049747263)
--  3) Préparer la table trackers_sync_log (utilisée plus tard par l'edge function)
-- ============================================================================

-- 1. Purge complète des positions (les FK vers vehicules empêcheraient sinon)
TRUNCATE TABLE public.vehicules_positions RESTART IDENTITY CASCADE;

-- 2. Purge complète des véhicules fictifs
TRUNCATE TABLE public.vehicules RESTART IDENTITY CASCADE;

-- 3. Insertion du véhicule réel : Renault Kangoo équipé Gemstone
INSERT INTO public.vehicules (
  code,
  libelle,
  marque,
  modele,
  tracker_id,        -- IMEI 15 chiffres du Gemstone (lu sur l'app CPH Trackers)
  tracker_type,      -- 'gemstone' = Copenhagen Trackers Gemstone (4G + SIM intégrée)
  statut,
  km_actuel
) VALUES (
  'KANGOO-01',
  'Renault Kangoo',
  'Renault',
  'Kangoo',
  '860873049747263',
  'gemstone',
  'actif',
  0
);

-- 4. Création de la table de logs de sync trackers
--    (calquée sur le pattern roller_sync_log déjà en place)
CREATE TABLE IF NOT EXISTS public.trackers_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL DEFAULT 'copenhagen_trackers',
  type_sync       TEXT NOT NULL,                -- 'positions', 'devices', 'auth'
  statut          TEXT NOT NULL,                -- 'success', 'partial', 'failed'
  nb_trackers     INTEGER DEFAULT 0,
  nb_positions    INTEGER DEFAULT 0,
  duree_ms        INTEGER,
  http_status     INTEGER,
  message_erreur  TEXT,
  payload_debug   JSONB,
  demarre_le      TIMESTAMPTZ NOT NULL DEFAULT now(),
  termine_le      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trackers_sync_log_demarre_le
  ON public.trackers_sync_log(demarre_le DESC);

CREATE INDEX IF NOT EXISTS idx_trackers_sync_log_statut
  ON public.trackers_sync_log(statut, demarre_le DESC);

-- 5. RLS sur la table de logs
ALTER TABLE public.trackers_sync_log ENABLE ROW LEVEL SECURITY;

-- Lecture : Direction + Chef maintenance + Admin IT
CREATE POLICY "trackers_sync_log_lecture"
  ON public.trackers_sync_log
  FOR SELECT
  TO authenticated
  USING (
    current_role_code() = ANY (ARRAY[
      'direction'::role_utilisateur,
      'chef_maintenance'::role_utilisateur,
      'admin_it'::role_utilisateur
    ])
  );

-- Insertion : service_role uniquement (edge functions)
-- (Pas de policy explicite => seul le service_role pourra écrire,
--  ce qui est exactement le comportement souhaité.)

-- 6. Commentaires pour documentation
COMMENT ON TABLE public.trackers_sync_log IS
  'Journal des synchronisations avec les API de trackers GPS (Copenhagen Trackers, etc.). Pattern identique à roller_sync_log.';

COMMENT ON COLUMN public.vehicules.tracker_id IS
  'Identifiant unique du tracker côté constructeur. Pour Gemstone : IMEI 15 chiffres lu dans l''app CPH Trackers (Informations relatives à l''appareil > Numéro IMEI).';

COMMENT ON COLUMN public.vehicules.tracker_type IS
  'Type de tracker. Valeurs : ''gemstone'' (Copenhagen Trackers Gemstone, 4G+SIM, profils Live/Daily/Parking), ''copenhagen'' (legacy/Cobblestone). Réservé pour évolutions futures.';;
