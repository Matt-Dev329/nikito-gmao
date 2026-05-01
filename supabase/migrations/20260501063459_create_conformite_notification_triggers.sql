/*
  # Triggers de notifications instantanees pour Conformite ERP

  1. Fonction utilitaire
    - `fn_destinataires_conformite(p_parc_id)` : retourne les uuid des utilisateurs a notifier
      (direction, chef_maintenance de tous parcs, et manager_parc du parc concerne)

  2. Triggers crees
    - `fn_notify_prescription_creee` : AFTER INSERT sur prescriptions_securite
    - `fn_notify_prescription_levee` : AFTER UPDATE sur prescriptions_securite (statut -> levee_validee)
    - `fn_notify_commission_creee` : AFTER INSERT sur commissions_securite
    - `fn_notify_commission_pv_recu` : AFTER UPDATE sur commissions_securite (resultat renseigne)
    - `fn_notify_phase_changement` : AFTER INSERT sur parcs_phases

  3. Securite
    - Toutes les fonctions sont SECURITY DEFINER avec search_path = public
    - Les notifications sont inserees dans notifications_conformite (RLS deja en place)
*/

CREATE OR REPLACE FUNCTION public.fn_destinataires_conformite(p_parc_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.id
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.actif = true
    AND (
      r.code IN ('direction', 'chef_maintenance')
      OR (
        r.code = 'manager_parc'
        AND EXISTS (
          SELECT 1 FROM parcs_utilisateurs pu
          WHERE pu.utilisateur_id = u.id
            AND pu.parc_id = p_parc_id
        )
      )
    );
$$;

-- Trigger 1 : prescription creee
CREATE OR REPLACE FUNCTION public.fn_notify_prescription_creee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_nom TEXT;
  v_dest_id UUID;
  v_titre TEXT;
  v_message TEXT;
BEGIN
  SELECT nom INTO v_parc_nom FROM parcs WHERE id = NEW.parc_id;

  v_titre := 'Nouvelle reserve : ' || COALESCE(NEW.numero_prescription, '');
  v_message := COALESCE(v_parc_nom, '') || ' - ' || COALESCE(NEW.intitule, '') ||
    ' (gravite ' || COALESCE(NEW.gravite, 'n/a') ||
    ', delai ' || COALESCE(to_char(NEW.delai_levee, 'DD/MM/YYYY'), 'non defini') || ')';

  FOR v_dest_id IN SELECT fn_destinataires_conformite(NEW.parc_id) LOOP
    INSERT INTO notifications_conformite (
      destinataire_id, parc_id, type_notification, prescription_id, titre, message
    ) VALUES (
      v_dest_id, NEW.parc_id, 'prescription_creee', NEW.id, v_titre, v_message
    );
  END LOOP;

  IF NEW.responsable_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM notifications_conformite
    WHERE prescription_id = NEW.id AND destinataire_id = NEW.responsable_id
      AND type_notification = 'prescription_creee'
  ) THEN
    INSERT INTO notifications_conformite (
      destinataire_id, parc_id, type_notification, prescription_id, titre, message
    ) VALUES (
      NEW.responsable_id, NEW.parc_id, 'prescription_creee', NEW.id,
      'Reserve assignee : ' || COALESCE(NEW.numero_prescription, ''),
      v_message
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_prescription_creee ON prescriptions_securite;
CREATE TRIGGER trg_notify_prescription_creee
  AFTER INSERT ON prescriptions_securite
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_prescription_creee();

-- Trigger 2 : prescription levee validee
CREATE OR REPLACE FUNCTION public.fn_notify_prescription_levee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_nom TEXT;
  v_dest_id UUID;
  v_titre TEXT;
  v_message TEXT;
BEGIN
  IF NEW.statut = 'levee_validee' AND OLD.statut IS DISTINCT FROM 'levee_validee' THEN
    SELECT nom INTO v_parc_nom FROM parcs WHERE id = NEW.parc_id;

    v_titre := 'Reserve levee : ' || COALESCE(NEW.numero_prescription, '');
    v_message := COALESCE(v_parc_nom, '') || ' - ' || COALESCE(NEW.intitule, '') ||
      ' (validee le ' || to_char(COALESCE(NEW.date_levee_effective, CURRENT_DATE), 'DD/MM/YYYY') || ')';

    FOR v_dest_id IN SELECT fn_destinataires_conformite(NEW.parc_id) LOOP
      INSERT INTO notifications_conformite (
        destinataire_id, parc_id, type_notification, prescription_id, titre, message
      ) VALUES (
        v_dest_id, NEW.parc_id, 'prescription_levee', NEW.id, v_titre, v_message
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_prescription_levee ON prescriptions_securite;
CREATE TRIGGER trg_notify_prescription_levee
  AFTER UPDATE ON prescriptions_securite
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_prescription_levee();

-- Trigger 3 : commission creee
CREATE OR REPLACE FUNCTION public.fn_notify_commission_creee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_nom TEXT;
  v_dest_id UUID;
  v_titre TEXT;
  v_message TEXT;
BEGIN
  SELECT nom INTO v_parc_nom FROM parcs WHERE id = NEW.parc_id;

  v_titre := 'Commission ' || COALESCE(NEW.type_commission, '') || ' planifiee';
  v_message := COALESCE(v_parc_nom, '') || ' - le ' ||
    to_char(NEW.date_visite, 'DD/MM/YYYY') ||
    CASE WHEN NEW.president_commission IS NOT NULL
      THEN ' (president : ' || NEW.president_commission || ')'
      ELSE ''
    END;

  FOR v_dest_id IN SELECT fn_destinataires_conformite(NEW.parc_id) LOOP
    INSERT INTO notifications_conformite (
      destinataire_id, parc_id, type_notification, commission_id, titre, message
    ) VALUES (
      v_dest_id, NEW.parc_id, 'commission_creee', NEW.id, v_titre, v_message
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commission_creee ON commissions_securite;
CREATE TRIGGER trg_notify_commission_creee
  AFTER INSERT ON commissions_securite
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_commission_creee();

-- Trigger 4 : commission PV recu
CREATE OR REPLACE FUNCTION public.fn_notify_commission_pv_recu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_nom TEXT;
  v_dest_id UUID;
  v_titre TEXT;
  v_message TEXT;
BEGIN
  IF NEW.resultat IS NOT NULL
     AND NEW.resultat <> 'en_attente_pv'
     AND (OLD.resultat IS NULL OR OLD.resultat = 'en_attente_pv' OR OLD.resultat IS DISTINCT FROM NEW.resultat)
  THEN
    SELECT nom INTO v_parc_nom FROM parcs WHERE id = NEW.parc_id;

    v_titre := 'PV commission recu : ' || COALESCE(NEW.type_commission, '');
    v_message := COALESCE(v_parc_nom, '') || ' - resultat : ' || NEW.resultat ||
      CASE WHEN NEW.numero_pv IS NOT NULL THEN ' (PV ' || NEW.numero_pv || ')' ELSE '' END;

    FOR v_dest_id IN SELECT fn_destinataires_conformite(NEW.parc_id) LOOP
      INSERT INTO notifications_conformite (
        destinataire_id, parc_id, type_notification, commission_id, titre, message
      ) VALUES (
        v_dest_id, NEW.parc_id, 'commission_pv_recu', NEW.id, v_titre, v_message
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commission_pv_recu ON commissions_securite;
CREATE TRIGGER trg_notify_commission_pv_recu
  AFTER UPDATE ON commissions_securite
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_commission_pv_recu();

-- Trigger 5 : changement de phase
CREATE OR REPLACE FUNCTION public.fn_notify_phase_changement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parc_nom TEXT;
  v_dest_id UUID;
  v_titre TEXT;
  v_message TEXT;
BEGIN
  SELECT nom INTO v_parc_nom FROM parcs WHERE id = NEW.parc_id;

  v_titre := 'Phase changee : ' || REPLACE(NEW.phase, '_', ' ');
  v_message := COALESCE(v_parc_nom, '') || ' - depuis le ' ||
    to_char(NEW.date_debut, 'DD/MM/YYYY') ||
    CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> ''
      THEN ' - ' || NEW.notes
      ELSE ''
    END;

  FOR v_dest_id IN SELECT fn_destinataires_conformite(NEW.parc_id) LOOP
    INSERT INTO notifications_conformite (
      destinataire_id, parc_id, type_notification, titre, message
    ) VALUES (
      v_dest_id, NEW.parc_id, 'phase_changement', v_titre, v_message
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_phase_changement ON parcs_phases;
CREATE TRIGGER trg_notify_phase_changement
  AFTER INSERT ON parcs_phases
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_phase_changement();
