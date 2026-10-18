-- Opérations : les directeurs de parc et les managers principaux voient les
-- tickets et peuvent les supprimer (avec motif) ; les managers voient seulement.
-- Plus aucune action d'intervention pour les directeurs (démarrer, pause,
-- reprise, réassignation, pièces, photos, extérieur, clôture).

-- 1. Fonctions d'action : directeur_parc retiré des rôles autorisés
DO $migration$
DECLARE
  f record;
  v_def text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('demarrer_intervention_photo', 'mettre_en_pause_incident', 'reprendre_incident',
                        'reassigner_incident', 'cloturer_ticket_exterieur', 'confier_intervenant_exterieur',
                        'mettre_en_attente_piece', 'lever_attente_piece', 'reprendre_ticket_en_interne',
                        'piece_depuis_catalogue')
  LOOP
    v_def := pg_get_functiondef(f.oid);
    IF position('''directeur_parc'', ''technicien''' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Liste de rôles inattendue dans %', f.proname;
    END IF;
    EXECUTE replace(v_def, '''directeur_parc'', ''technicien''', '''technicien''');
  END LOOP;

  SELECT p.oid INTO f FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'ajouter_photo_ticket';
  v_def := pg_get_functiondef(f.oid);
  IF position('''directeur_parc'', ''manager_parc'', ''technicien''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Liste de rôles inattendue dans ajouter_photo_ticket';
  END IF;
  EXECUTE replace(v_def, '''directeur_parc'', ''manager_parc'', ''technicien''', '''technicien''');
END
$migration$;

-- 2. Suppression : directeurs et managers principaux, sur tout ticket de leur parc
CREATE OR REPLACE FUNCTION public.supprimer_ticket(p_incident_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Indique le motif de la suppression';
  END IF;
  IF NOT peut_valider_ticket(p_incident_id) THEN
    RAISE EXCEPTION 'Tu ne peux pas supprimer ce ticket' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents
  SET statut = 'annule',
      validation_manager = CASE WHEN validation_manager = 'en_attente' THEN 'refuse' ELSE validation_manager END,
      supprime_motif = trim(p_motif),
      supprime_par_id = (SELECT current_utilisateur_id()),
      supprime_le = now()
  WHERE id = p_incident_id AND statut <> 'annule';
END;
$function$;

-- 3. Tickets : les directeurs passent en lecture seule (même périmètre qu'avant)
CREATE POLICY inc_directeur_parc_lecture ON public.incidents
  FOR SELECT TO authenticated
  USING (((SELECT current_role_code()) = 'directeur_parc'::role_utilisateur)
         AND ((equipement_id IN (SELECT e.id FROM equipements e WHERE e.parc_id = ANY (current_parc_ids())))
              OR (assigne_a_id = (SELECT current_utilisateur_id()))
              OR ((equipement_id IS NULL)
                  AND ((declare_par_id = (SELECT current_utilisateur_id()))
                       OR (parcs_de_utilisateur(declare_par_id) && current_parc_ids())))));

ALTER POLICY inc_direction_total ON public.incidents
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND ((equipement_id IN (SELECT e.id FROM equipements e WHERE e.parc_id = ANY (current_parc_ids())))
                  OR (assigne_a_id = (SELECT current_utilisateur_id()))
                  OR ((equipement_id IS NULL)
                      AND ((declare_par_id = (SELECT current_utilisateur_id()))
                           OR (parcs_de_utilisateur(declare_par_id) && current_parc_ids()))))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND ((equipement_id IS NULL)
                  OR (equipement_id IN (SELECT e.id FROM equipements e WHERE e.parc_id = ANY (current_parc_ids())))
                  OR (assigne_a_id = (SELECT current_utilisateur_id())))));

-- 4. Interventions et pièces : écriture réservée aux techniciens, chef, direction
ALTER POLICY interv_ecriture_techniciens ON public.interventions
  USING (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND (EXISTS (SELECT 1 FROM incidents i WHERE i.id = interventions.incident_id))))
  WITH CHECK (((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
         OR (((SELECT current_role_code()) = 'technicien'::role_utilisateur)
             AND (EXISTS (SELECT 1 FROM incidents i WHERE i.id = interventions.incident_id))));

ALTER POLICY pieces_util_ecriture_techniciens ON public.pieces_utilisees
  USING ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]))
  WITH CHECK ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]));
