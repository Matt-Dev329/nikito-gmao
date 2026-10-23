-- Réouverture d'un ticket résolu / fermé, avec motif obligatoire : chef
-- d'équipe, direction et admin IT. Le ticket repart dans « À faire » (ou
-- reste assigné au même technicien), les interventions passées sont
-- conservées et la prochaine clôture redemande le test de l'activité.

CREATE OR REPLACE FUNCTION public.rouvrir_ticket(p_incident_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_motif text := trim(coalesce(p_motif, ''));
  v_incident record;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF current_role_code()::text NOT IN ('chef_maintenance', 'direction', 'admin_it') THEN
    RAISE EXCEPTION 'Réouverture réservée au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  IF length(v_motif) < 5 THEN
    RAISE EXCEPTION 'Motif de réouverture obligatoire';
  END IF;

  SELECT id, statut, numero_bt, assigne_a_id INTO v_incident
  FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.statut NOT IN ('resolu', 'ferme') THEN
    RAISE EXCEPTION 'Seul un ticket résolu ou fermé peut être rouvert';
  END IF;

  UPDATE incidents
     SET statut = CASE WHEN assigne_a_id IS NOT NULL THEN 'assigne' ELSE 'ouvert' END::statut_incident,
         resolu_le = NULL,
         resolu_par_id = NULL,
         ferme_le = NULL,
         test_activite = NULL,
         externe = false,
         attente_piece = false,
         pause_motif = NULL,
         pause_depuis = NULL,
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
           'reouvertures',
           coalesce(meta->'reouvertures', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'le', now(), 'par_id', v_moi,
             'par_nom', (SELECT prenom || ' ' || nom FROM utilisateurs WHERE id = v_moi),
             'motif', v_motif, 'statut_avant', v_incident.statut)))
   WHERE id = p_incident_id;

  -- Le technicien assigné est prévenu
  IF v_incident.assigne_a_id IS NOT NULL AND v_incident.assigne_a_id <> v_moi THEN
    BEGIN
      PERFORM notifier_push(v_incident.assigne_a_id, 'Ticket rouvert · ' || v_incident.numero_bt,
        v_motif, '/gmao/operations/' || v_incident.numero_bt);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.rouvrir_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rouvrir_ticket(uuid, text) TO authenticated;
