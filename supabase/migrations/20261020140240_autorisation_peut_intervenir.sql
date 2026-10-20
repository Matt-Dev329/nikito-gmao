-- Autorisation individuelle « peut intervenir sur les tickets » : une personne
-- qui n'est pas technicien (ex. un directeur de parc) peut démarrer, mettre en
-- pause / attente de pièce et clôturer les tickets de SES parcs, sans changer
-- de rôle. Réglée par le chef d'équipe, la direction ou l'admin IT.

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS peut_intervenir boolean NOT NULL DEFAULT false;

-- Vrai si l'utilisateur connecté a l'autorisation et que le ticket est sur un de ses parcs
CREATE OR REPLACE FUNCTION public.intervenant_autorise(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs u
    WHERE u.id = current_utilisateur_id() AND u.actif AND u.peut_intervenir
  )
  AND EXISTS (
    SELECT 1 FROM incidents i
    LEFT JOIN equipements e ON e.id = i.equipement_id
    WHERE i.id = p_incident_id
      AND (e.parc_id = ANY (current_parc_ids())
           OR (i.equipement_id IS NULL AND parcs_du_ticket(i.id) && current_parc_ids()))
  );
$function$;
REVOKE ALL ON FUNCTION public.intervenant_autorise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intervenant_autorise(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_peut_intervenir(p_utilisateur_id uuid, p_autorise boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'admin_it') THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  UPDATE utilisateurs SET peut_intervenir = coalesce(p_autorise, false) WHERE id = p_utilisateur_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.definir_peut_intervenir(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_peut_intervenir(uuid, boolean) TO authenticated;

-- Actions sur ticket : l'autorisation s'ajoute aux rôles déjà permis
DO $do$
DECLARE
  f text;
  def text;
  ancien constant text := $$IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'technicien', 'admin_it') THEN$$;
  nouveau constant text := $$IF (v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'technicien', 'admin_it')) AND NOT intervenant_autorise(p_incident_id) THEN$$;
BEGIN
  FOREACH f IN ARRAY ARRAY['demarrer_intervention_photo', 'mettre_en_pause_incident', 'reprendre_incident',
                           'mettre_en_attente_piece', 'lever_attente_piece', 'ajouter_photo_ticket',
                           'confier_intervenant_exterieur', 'reprendre_ticket_en_interne', 'cloturer_ticket_exterieur']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p
    WHERE p.proname = f AND p.pronamespace = 'public'::regnamespace;
    IF def IS NULL OR position(ancien IN def) = 0 OR position('p_incident_id' IN def) = 0 THEN
      RAISE EXCEPTION 'Fonction % : contrôle de rôle attendu introuvable', f;
    END IF;
    EXECUTE replace(def, ancien, nouveau);
  END LOOP;
END;
$do$;

-- Interventions et pièces utilisées (clôture faite depuis l'appli)
ALTER POLICY interv_ecriture_techniciens ON public.interventions
  USING (
    ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
    OR ((SELECT current_role_code()) = 'technicien'::role_utilisateur AND EXISTS (SELECT 1 FROM incidents i WHERE i.id = interventions.incident_id))
    OR intervenant_autorise(incident_id)
  )
  WITH CHECK (
    ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur]))
    OR ((SELECT current_role_code()) = 'technicien'::role_utilisateur AND EXISTS (SELECT 1 FROM incidents i WHERE i.id = interventions.incident_id))
    OR intervenant_autorise(incident_id)
  );

ALTER POLICY pieces_util_ecriture_techniciens ON public.pieces_utilisees
  USING (
    ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]))
    OR EXISTS (SELECT 1 FROM interventions iv WHERE iv.id = pieces_utilisees.intervention_id AND intervenant_autorise(iv.incident_id))
  )
  WITH CHECK (
    ((SELECT current_role_code()) = ANY (ARRAY['direction'::role_utilisateur, 'chef_maintenance'::role_utilisateur, 'technicien'::role_utilisateur]))
    OR EXISTS (SELECT 1 FROM interventions iv WHERE iv.id = pieces_utilisees.intervention_id AND intervenant_autorise(iv.incident_id))
  );

-- Ticket passé « résolu » à la clôture
CREATE POLICY inc_intervenant_autorise ON public.incidents
  FOR UPDATE TO authenticated
  USING (intervenant_autorise(id))
  WITH CHECK (intervenant_autorise(id));

-- Simon Gohier (directeur FRA), accord de Ryad Neki le 20/10/2026
UPDATE public.utilisateurs SET peut_intervenir = true
WHERE id = '9843d23c-5279-4a7f-8bb5-85f053b9d0fb';
