-- Tickets :
-- 1. Arcade : pas de validation, même signalés par un manager non principal.
-- 2. Doublons : au signalement, liste des tickets déjà en cours sur le même
--    équipement (ou, sans équipement, sur la même catégorie du même parc).
-- 3. Refus d'un ticket à valider, avec une justification envoyée en
--    notification à la personne qui l'a signalé.

-- 1. Validation : les tickets Arcade passent directement
CREATE OR REPLACE FUNCTION public.fn_ticket_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role role_utilisateur;
  v_parc uuid;
  v_categorie uuid;
BEGIN
  SELECT r.code, trim(coalesce(u.prenom, '') || ' ' || coalesce(u.nom, ''))
    INTO v_role, NEW.declare_par_nom
  FROM utilisateurs u JOIN roles r ON r.id = u.role_id
  WHERE u.id = NEW.declare_par_id;

  SELECT parc_id, categorie_id INTO v_parc, v_categorie FROM equipements WHERE id = NEW.equipement_id;
  IF v_categorie IS NULL AND NEW.meta ? 'categorie_id' THEN
    BEGIN
      v_categorie := (NEW.meta->>'categorie_id')::uuid;
    EXCEPTION WHEN others THEN
      v_categorie := NULL;
    END;
  END IF;

  IF v_categorie = ANY (categories_arcade()) THEN
    -- Arcade : pas de validation
    IF NEW.validation_manager IS NULL OR NEW.validation_manager = 'en_attente' THEN
      NEW.validation_manager := 'auto';
    END IF;
  ELSIF v_role = 'staff_operationnel'
     OR (v_role = 'manager_parc' AND NOT EXISTS (
           SELECT 1 FROM parcs_utilisateurs pu
           WHERE pu.utilisateur_id = NEW.declare_par_id AND pu.est_manager
             AND (v_parc IS NULL OR pu.parc_id = v_parc))) THEN
    NEW.validation_manager := 'en_attente';
  ELSIF NEW.validation_manager IS NULL OR NEW.validation_manager = 'en_attente' THEN
    NEW.validation_manager := 'auto';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Tickets déjà en cours pour le même équipement (ou la même catégorie du
--    parc quand l'équipement n'est pas dans la liste)
CREATE OR REPLACE FUNCTION public.tickets_en_cours_similaires(p_parc_id uuid, p_equipement_id uuid, p_categorie_id uuid)
RETURNS TABLE (id uuid, numero_bt text, titre text, description text, statut text, declare_le timestamptz, declare_par_nom text, meme_equipement boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT i.id, i.numero_bt, i.titre, i.description, i.statut::text, i.declare_le, i.declare_par_nom,
         i.equipement_id IS NOT DISTINCT FROM p_equipement_id AND p_equipement_id IS NOT NULL
  FROM incidents i
  LEFT JOIN equipements e ON e.id = i.equipement_id
  WHERE current_utilisateur_id() IS NOT NULL
    AND (p_parc_id = ANY (current_parc_ids())
         OR (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it'))
    AND i.statut NOT IN ('resolu', 'ferme', 'annule')
    AND NOT coalesce(i.est_brouillon, false)
    AND NOT coalesce(i.est_formation, false)
    AND coalesce(i.validation_manager, '') <> 'refuse'
    AND (
      (p_equipement_id IS NOT NULL AND i.equipement_id = p_equipement_id)
      OR (p_equipement_id IS NULL AND i.equipement_id IS NULL
          AND i.meta->>'categorie_id' = p_categorie_id::text
          AND parc_ticket(i) = p_parc_id)
    )
  ORDER BY i.declare_le DESC
  LIMIT 5;
$function$;
REVOKE ALL ON FUNCTION public.tickets_en_cours_similaires(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickets_en_cours_similaires(uuid, uuid, uuid) TO authenticated;

-- 3. Refus d'un ticket à valider (mêmes droits que la validation)
CREATE OR REPLACE FUNCTION public.refuser_ticket(p_incident_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_motif text := trim(coalesce(p_motif, ''));
  v_moi uuid := (SELECT current_utilisateur_id());
  v_incident incidents%ROWTYPE;
  v_qui text;
BEGIN
  IF length(v_motif) < 5 THEN
    RAISE EXCEPTION 'Indique la justification du refus';
  END IF;
  IF NOT peut_valider_ticket(p_incident_id) THEN
    RAISE EXCEPTION 'Tu ne peux pas refuser ce ticket' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_incident FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.validation_manager IS DISTINCT FROM 'en_attente' OR v_incident.statut = 'annule' THEN
    RAISE EXCEPTION 'Ce ticket n''est plus en attente de validation';
  END IF;

  UPDATE incidents
  SET statut = 'annule',
      validation_manager = 'refuse',
      supprime_motif = 'Refusé : ' || v_motif,
      supprime_par_id = v_moi,
      supprime_le = now()
  WHERE id = p_incident_id;

  IF v_incident.declare_par_id IS DISTINCT FROM v_moi THEN
    SELECT trim(prenom || ' ' || nom) INTO v_qui FROM utilisateurs WHERE id = v_moi;
    PERFORM notifier_push(v_incident.declare_par_id,
      'Ticket refusé · ' || v_incident.numero_bt,
      v_motif || COALESCE(' (' || v_qui || ')', ''),
      '/gmao/operations/' || v_incident.numero_bt);
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.refuser_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refuser_ticket(uuid, text) TO authenticated;
