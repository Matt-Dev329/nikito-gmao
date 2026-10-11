/*
  # Contrôles staff : double validation signalée + « jour » en heure de Paris

  1. `valider_controle_staff` : si un contrôle est déjà validé pour ce parc,
     ce type et cette date, la fonction renvoyait son id sans enregistrer les
     nouvelles saisies — l'écran affichait « validé » alors que tout était
     perdu. Elle lève désormais une erreur explicite, affichée à l'agent.
  2. `incidents_du_jour_utilisateur` : « Mes signalements du jour » utilisait
     le jour UTC (entre 0 h et 2 h, ceux de la veille). Jour calculé en
     heure de Paris.
*/

CREATE OR REPLACE FUNCTION public.valider_controle_staff(p_parc_id uuid, p_type text, p_date_planifiee date, p_realise_par_id uuid, p_realise_par_nom text, p_realise_par_role text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_controle_id UUID;
v_now TIMESTAMPTZ := now();
v_item JSONB;
BEGIN
-- Validate the user exists and is active
IF NOT EXISTS (
SELECT 1 FROM utilisateurs WHERE id = p_realise_par_id AND actif = true
) THEN
RAISE EXCEPTION 'Utilisateur invalide ou inactif';
END IF;

-- Validate the parc exists and is active
IF NOT EXISTS (
SELECT 1 FROM parcs WHERE id = p_parc_id AND actif = true
) THEN
RAISE EXCEPTION 'Parc invalide ou inactif';
END IF;

-- Check for existing control (pending or in progress)
SELECT id INTO v_controle_id
FROM controles
WHERE parc_id = p_parc_id
AND type = p_type::type_controle
AND date_planifiee = p_date_planifiee
AND est_formation = false
AND statut IN ('a_faire', 'en_cours')
LIMIT 1;

IF v_controle_id IS NOT NULL THEN
-- Delete pre-existing items to avoid duplicates
DELETE FROM controle_items WHERE controle_id = v_controle_id;

UPDATE controles SET
date_demarrage = v_now,
date_validation = v_now,
realise_par_id = p_realise_par_id,
realise_par_nom = p_realise_par_nom,
realise_par_role = p_realise_par_role,
valide_par_id = p_realise_par_id,
statut = 'valide'
WHERE id = v_controle_id;
ELSE
-- Déjà validé pour ce jour : on le signale au lieu de perdre la saisie en silence
IF EXISTS (
SELECT 1
FROM controles
WHERE parc_id = p_parc_id
AND type = p_type::type_controle
AND date_planifiee = p_date_planifiee
AND est_formation = false
AND statut = 'valide'
) THEN
RAISE EXCEPTION 'Contrôle déjà validé pour le % : la nouvelle saisie n''a pas été enregistrée', to_char(p_date_planifiee, 'DD/MM/YYYY');
END IF;

INSERT INTO controles (
parc_id, type, date_planifiee, date_demarrage, date_validation,
realise_par_id, realise_par_nom, realise_par_role, valide_par_id,
statut, est_formation
) VALUES (
p_parc_id, p_type::type_controle, p_date_planifiee, v_now, v_now,
p_realise_par_id, p_realise_par_nom, p_realise_par_role, p_realise_par_id,
'valide', false
)
RETURNING id INTO v_controle_id;
END IF;

-- Insert items
FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
LOOP
INSERT INTO controle_items (
controle_id, point_id, etat, commentaire, photo_url, saisi_par_id
) VALUES (
v_controle_id,
(v_item->>'point_id')::UUID,
(v_item->>'etat')::etat_controle_item,
v_item->>'commentaire',
v_item->>'photo_url',
p_realise_par_id
);
END LOOP;

RETURN v_controle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.incidents_du_jour_utilisateur(p_user_id uuid)
 RETURNS TABLE(id uuid, numero_bt text, titre text, description text, statut statut_incident, declare_le timestamp with time zone, equipement_libelle text, equipement_code text, parc_nom text, priorite_nom text, priorite_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT i.id, i.numero_bt, i.titre, i.description, i.statut, i.declare_le,
         e.libelle, e.code, p.nom, np.nom, np.code::text
  FROM incidents i
  LEFT JOIN equipements e ON e.id = i.equipement_id
  LEFT JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  WHERE i.declare_par_id = p_user_id
    AND i.declare_le >= (date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')
    AND i.est_brouillon = false
  ORDER BY i.declare_le DESC;
$function$;
