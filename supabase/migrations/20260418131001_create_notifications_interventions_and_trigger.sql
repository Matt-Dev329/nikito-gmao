/*
  # Notifications interventions pour managers de parc

  1. New Tables
    - `notifications_interventions`
      - `id` (uuid, primary key)
      - `parc_id` (uuid, FK parcs) - parc concerne
      - `incident_id` (uuid, FK incidents) - incident lie
      - `type` (text) - type de notification: demarrage / terminee / pause / reprise
      - `titre` (text) - titre court
      - `message` (text) - message complet
      - `technicien_nom` (text) - nom du technicien
      - `equipement_code` (text) - code equipement
      - `duree_minutes` (int) - duree si terminee
      - `destinataire_role` (text[]) - roles destinataires
      - `lien_page` (text) - lien de navigation
      - `lue` (boolean) - marqueur lecture
      - `cree_le` (timestamptz) - date creation

  2. Security
    - Enable RLS on `notifications_interventions`
    - Authenticated users can read notifications for their parcs
    - System (via trigger) inserts notifications

  3. Trigger
    - `trg_notif_intervention_statut` on incidents
    - Fires on UPDATE of statut column
    - Creates notification for manager_parc role
*/

CREATE TABLE IF NOT EXISTS notifications_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES parcs(id),
  incident_id uuid NOT NULL REFERENCES incidents(id),
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('demarrage', 'terminee', 'pause', 'reprise', 'info')),
  titre text NOT NULL,
  message text NOT NULL DEFAULT '',
  technicien_nom text,
  equipement_code text,
  duree_minutes integer,
  destinataire_role text[] NOT NULL DEFAULT '{manager_parc}',
  lien_page text DEFAULT '/gmao/operations',
  lue boolean NOT NULL DEFAULT false,
  cree_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read intervention notifications for their parcs"
  ON notifications_interventions
  FOR SELECT
  TO authenticated
  USING (
    parc_id IN (
      SELECT pu.parc_id FROM parcs_utilisateurs pu
      WHERE pu.utilisateur_id = (
        SELECT u.id FROM utilisateurs u WHERE u.auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "Authenticated users can mark notifications as read"
  ON notifications_interventions
  FOR UPDATE
  TO authenticated
  USING (
    parc_id IN (
      SELECT pu.parc_id FROM parcs_utilisateurs pu
      WHERE pu.utilisateur_id = (
        SELECT u.id FROM utilisateurs u WHERE u.auth_user_id = auth.uid() LIMIT 1
      )
    )
  )
  WITH CHECK (
    parc_id IN (
      SELECT pu.parc_id FROM parcs_utilisateurs pu
      WHERE pu.utilisateur_id = (
        SELECT u.id FROM utilisateurs u WHERE u.auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE OR REPLACE FUNCTION notify_manager_intervention_statut()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipement_code text;
  v_equipement_libelle text;
  v_parc_id uuid;
  v_technicien_nom text;
  v_titre text;
  v_message text;
  v_type text;
  v_duree integer;
BEGIN
  IF OLD.statut = NEW.statut THEN
    RETURN NEW;
  END IF;

  SELECT e.code, e.libelle, e.parc_id
  INTO v_equipement_code, v_equipement_libelle, v_parc_id
  FROM equipements e
  WHERE e.id = NEW.equipement_id;

  SELECT (u.prenom || ' ' || u.nom)
  INTO v_technicien_nom
  FROM interventions i
  JOIN utilisateurs u ON u.id = i.technicien_id
  WHERE i.incident_id = NEW.id
  ORDER BY i.debut DESC
  LIMIT 1;

  IF v_technicien_nom IS NULL THEN
    v_technicien_nom := 'Technicien';
  END IF;

  v_duree := NULL;

  IF NEW.statut = 'en_cours' AND OLD.statut IN ('ouvert', 'assigne') THEN
    v_type := 'demarrage';
    v_titre := 'Intervention demarree';
    v_message := v_technicien_nom || ' a demarre l''intervention sur ' || v_equipement_code;
  ELSIF NEW.statut = 'resolu' THEN
    v_type := 'terminee';
    v_titre := 'Intervention terminee';
    IF NEW.resolu_le IS NOT NULL AND NEW.declare_le IS NOT NULL THEN
      v_duree := EXTRACT(EPOCH FROM (NEW.resolu_le - NEW.declare_le)) / 60;
    END IF;
    IF v_duree IS NOT NULL THEN
      v_message := v_technicien_nom || ' a termine l''intervention sur ' || v_equipement_code || ' -- resolu en ' || v_duree || ' min';
    ELSE
      v_message := v_technicien_nom || ' a termine l''intervention sur ' || v_equipement_code;
    END IF;
  ELSIF NEW.statut = 'annule' THEN
    v_type := 'info';
    v_titre := 'Intervention annulee';
    v_message := 'L''intervention sur ' || v_equipement_code || ' a ete annulee';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO notifications_interventions (
    parc_id, incident_id, type, titre, message,
    technicien_nom, equipement_code, duree_minutes,
    destinataire_role, lien_page
  ) VALUES (
    v_parc_id, NEW.id, v_type, v_titre, v_message,
    v_technicien_nom, v_equipement_code, v_duree,
    '{manager_parc}', '/gmao/operations'
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notif_intervention_statut'
  ) THEN
    CREATE TRIGGER trg_notif_intervention_statut
      AFTER UPDATE OF statut ON incidents
      FOR EACH ROW
      EXECUTE FUNCTION notify_manager_intervention_statut();
  END IF;
END $$;
