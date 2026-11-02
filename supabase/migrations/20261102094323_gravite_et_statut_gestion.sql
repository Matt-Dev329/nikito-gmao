/*
  # Gravité modifiable + changement de statut élargi à la gestion

  Depuis la fiche d'un ticket, la gestion peut corriger la gravité et le statut.
  Rôles : direction, chef d'équipe, directeur de parc (ses parcs), admin IT
  (cf ROLES_DIRECTION_PARC / peutModifierTicket côté front).

  1. `changer_priorite_incident` (nouveau) : Bloquant / Majeur / Mineur. C'est
     la RPC appelée par le badge ChoixGravite ; elle manquait de migration.
  2. `changer_statut_ticket` : on élargit la fonction existante (jusque-là
     réservée au chef d'équipe) à ces 4 rôles ; le directeur de parc reste
     limité à ses parcs (parcs_du_ticket). Toute la logique d'origine est
     conservée (clôture + test activité, attente de pièce, pause, historique
     meta.changements_statut, notification du technicien assigné).
  Script rejouable.
*/

-- 1. Gravité
CREATE OR REPLACE FUNCTION public.changer_priorite_incident(p_incident_id uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_role role_utilisateur;
  v_prio uuid;
BEGIN
  v_role := (SELECT current_role_code());
  IF v_role IS NULL OR v_role NOT IN ('direction','chef_maintenance','directeur_parc','admin_it') THEN
    RAISE EXCEPTION 'Non autorisé à modifier la gravité' USING ERRCODE = '42501';
  END IF;
  IF p_code NOT IN ('bloquant','majeur','mineur') THEN
    RAISE EXCEPTION 'Gravité invalide';
  END IF;
  SELECT id INTO v_prio FROM niveaux_priorite WHERE code = p_code;
  IF v_prio IS NULL THEN RAISE EXCEPTION 'Gravité introuvable'; END IF;
  IF v_role = 'directeur_parc' AND NOT (parcs_du_ticket(p_incident_id) && current_parc_ids()) THEN
    RAISE EXCEPTION 'Non autorisé sur ce ticket' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents SET priorite_id = v_prio, modifie_le = now() WHERE id = p_incident_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket introuvable'; END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.changer_priorite_incident(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.changer_priorite_incident(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.changer_priorite_incident(uuid,text) TO authenticated;

-- 2. Statut : élargissement aux 4 rôles (directeur de parc limité à ses parcs)
CREATE OR REPLACE FUNCTION public.changer_statut_ticket(p_incident_id uuid, p_statut text, p_motif text, p_test_activite boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_motif text := NULLIF(trim(coalesce(p_motif, '')), '');
  v_i record;
  v_avant text;
  v_cloture boolean := p_statut IN ('resolu', 'ferme');
  v_libelle text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF current_role_code()::text NOT IN ('direction','chef_maintenance','directeur_parc','admin_it') THEN
    RAISE EXCEPTION 'Changement de statut réservé à la gestion' USING ERRCODE = '42501';
  END IF;
  IF p_statut NOT IN ('ouvert', 'assigne', 'en_cours', 'en_pause', 'attente_piece', 'resolu', 'ferme') THEN
    RAISE EXCEPTION 'Statut inconnu : %', p_statut;
  END IF;

  SELECT id, statut, assigne_a_id, attente_piece, externe, est_formation, numero_bt
    INTO v_i FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF current_role_code()::text = 'directeur_parc' AND NOT (parcs_du_ticket(p_incident_id) && current_parc_ids()) THEN
    RAISE EXCEPTION 'Non autorisé sur ce ticket' USING ERRCODE = '42501';
  END IF;
  IF v_i.statut = 'annule' THEN
    RAISE EXCEPTION 'Ce ticket est supprimé';
  END IF;
  IF p_statut = 'assigne' AND v_i.assigne_a_id IS NULL THEN
    RAISE EXCEPTION 'Aucun technicien assigné à ce ticket : réassigne-le d''abord';
  END IF;
  IF v_cloture AND v_i.statut NOT IN ('resolu', 'ferme') AND p_test_activite IS NULL THEN
    RAISE EXCEPTION 'Test de l''activité obligatoire (oui ou non) pour clôturer le ticket';
  END IF;
  v_avant := CASE WHEN v_i.attente_piece AND v_i.statut NOT IN ('resolu', 'ferme') THEN 'attente_piece'
                  WHEN v_i.externe AND v_i.statut NOT IN ('resolu', 'ferme') THEN 'exterieur'
                  ELSE v_i.statut::text END;
  IF v_avant = p_statut THEN
    RETURN;
  END IF;
  v_libelle := CASE p_statut WHEN 'ouvert' THEN 'à faire' WHEN 'assigne' THEN 'assigné'
    WHEN 'en_cours' THEN 'en cours' WHEN 'en_pause' THEN 'en pause' WHEN 'attente_piece' THEN 'attente de pièce'
    WHEN 'resolu' THEN 'résolu' ELSE 'fermé' END;

  IF v_cloture AND v_i.statut NOT IN ('resolu', 'ferme') THEN
    UPDATE interventions
       SET fin = now(),
           test_activite = p_test_activite,
           actions_realisees = concat_ws(E'\n', nullif(actions_realisees, ''),
             'Statut passé à « ' || v_libelle || ' » par la gestion' || coalesce(' : ' || v_motif, ''))
     WHERE incident_id = p_incident_id AND fin IS NULL;
    IF NOT FOUND THEN
      INSERT INTO interventions (incident_id, technicien_id, debut, fin, actions_realisees, est_formation, test_activite)
      VALUES (p_incident_id, v_moi, now(), now(),
              'Statut passé à « ' || v_libelle || ' » par la gestion' || coalesce(' : ' || v_motif, ''),
              v_i.est_formation, p_test_activite);
    END IF;
  END IF;

  UPDATE incidents
     SET statut = CASE WHEN p_statut = 'attente_piece'
                       THEN (CASE WHEN statut IN ('resolu', 'ferme') THEN (CASE WHEN assigne_a_id IS NOT NULL THEN 'assigne' ELSE 'ouvert' END) ELSE statut::text END)
                       ELSE p_statut END::statut_incident,
         attente_piece = (p_statut = 'attente_piece'),
         attente_piece_detail = CASE WHEN p_statut = 'attente_piece' THEN coalesce(v_motif, attente_piece_detail, 'Pièce attendue') ELSE attente_piece_detail END,
         attente_piece_depuis = CASE WHEN p_statut = 'attente_piece' THEN coalesce(CASE WHEN attente_piece THEN attente_piece_depuis END, now()) ELSE attente_piece_depuis END,
         externe = false,
         pause_motif = CASE WHEN p_statut = 'en_pause' THEN coalesce(v_motif, 'Mis en pause par la gestion') END,
         pause_depuis = CASE WHEN p_statut = 'en_pause' THEN now() END,
         resolu_le = CASE WHEN v_cloture THEN coalesce(resolu_le, now()) END,
         resolu_par_id = CASE WHEN v_cloture THEN coalesce(resolu_par_id, v_moi) END,
         ferme_le = CASE WHEN p_statut = 'ferme' THEN now() END,
         test_activite = CASE WHEN v_cloture THEN coalesce(p_test_activite, test_activite) END,
         validation_manager = CASE WHEN v_cloture AND validation_manager = 'en_attente' THEN 'valide' ELSE validation_manager END,
         valide_le = CASE WHEN v_cloture AND validation_manager = 'en_attente' THEN now() ELSE valide_le END,
         valide_par_manager_id = CASE WHEN v_cloture AND validation_manager = 'en_attente' THEN v_moi ELSE valide_par_manager_id END,
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
           'changements_statut',
           coalesce(meta->'changements_statut', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'le', now(), 'par_id', v_moi,
             'par_nom', (SELECT prenom || ' ' || nom FROM utilisateurs WHERE id = v_moi),
             'avant', v_avant, 'apres', p_statut, 'motif', v_motif)))
   WHERE id = p_incident_id;

  IF v_i.assigne_a_id IS NOT NULL AND v_i.assigne_a_id <> v_moi THEN
    BEGIN
      PERFORM notifier_push(v_i.assigne_a_id, 'Statut modifié · ' || v_i.numero_bt,
        'Nouveau statut : ' || v_libelle || coalesce(' — ' || v_motif, ''),
        '/gmao/operations/' || v_i.numero_bt);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$fn$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261102094323', 'gravite_et_statut_gestion')
ON CONFLICT (version) DO NOTHING;
