/*
  # Notification manager : tickets sans équipement

  `notify_manager_intervention_statut` insérait une notification avec
  parc_id NULL pour un ticket sans équipement (parc déduit de l'équipement),
  ce qui violait la contrainte NOT NULL et FAISAIT ÉCHOUER le changement de
  statut lui-même (démarrage, clôture « résolu », annulation) sur ces tickets.
  Sans parc connu, la notification (destinée aux managers du parc) est
  simplement ignorée ; le libellé utilise le titre du ticket à défaut de code
  équipement.
*/

CREATE OR REPLACE FUNCTION public.notify_manager_intervention_statut()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

-- Sans équipement, pas de parc : pas de manager à notifier (et ne pas bloquer le changement de statut)
IF v_parc_id IS NULL THEN
RETURN NEW;
END IF;

v_equipement_code := COALESCE(v_equipement_code, NEW.titre);

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
$function$;
