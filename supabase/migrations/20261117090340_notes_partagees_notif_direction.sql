-- Notes (tickets et commandes) : le chef d'équipe, la direction et les
-- directeurs du parc concerné sont aussi prévenus à chaque note ajoutée.
CREATE OR REPLACE FUNCTION public.fn_push_note_partagee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auteur text;
  v_titre text;
  v_lien text;
  v_corps text := left(NEW.texte, 140);
  v_dest uuid;
  v_parc uuid;
  v_ticket incidents%ROWTYPE;
  v_commande commandes%ROWTYPE;
BEGIN
  SELECT trim(prenom || ' ' || nom) INTO v_auteur FROM utilisateurs WHERE id = NEW.auteur_id;

  IF NEW.objet_type = 'ticket' THEN
    SELECT * INTO v_ticket FROM incidents WHERE id = NEW.objet_id;
    IF v_ticket.id IS NULL THEN RETURN NEW; END IF;
    v_parc := parc_de_ticket(v_ticket.equipement_id, v_ticket.meta, v_ticket.declare_par_id);
    v_titre := 'Note · ' || v_ticket.numero_bt || COALESCE(' · ' || v_auteur, '');
    v_lien := '/gmao/operations/' || v_ticket.numero_bt;
    FOR v_dest IN
      SELECT DISTINCT d FROM (
        SELECT v_ticket.declare_par_id AS d
        UNION SELECT v_ticket.assigne_a_id
        UNION SELECT auteur_id FROM notes_partagees
              WHERE objet_type = 'ticket' AND objet_id = NEW.objet_id AND actif
        -- Chef d'équipe, direction et directeurs du parc du ticket
        UNION SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
              WHERE u.actif AND (
                r.code IN ('chef_maintenance', 'direction')
                OR (r.code = 'directeur_parc' AND EXISTS (
                      SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.parc_id = v_parc)))
      ) x
      WHERE d IS NOT NULL AND d <> NEW.auteur_id
    LOOP
      PERFORM notifier_push(v_dest, v_titre, v_corps, v_lien);
    END LOOP;
  ELSE
    SELECT * INTO v_commande FROM commandes WHERE id = NEW.objet_id;
    IF v_commande.id IS NULL THEN RETURN NEW; END IF;
    v_titre := 'Note · commande ' || v_commande.numero || COALESCE(' · ' || v_auteur, '');
    FOR v_dest IN
      SELECT DISTINCT d FROM (
        SELECT v_commande.demandeur_id AS d
        UNION SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
              WHERE u.actif AND (
                r.code IN ('chef_maintenance', 'direction')
                OR (r.code = 'directeur_parc' AND EXISTS (
                      SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.parc_id = v_commande.parc_id)))
        UNION SELECT unnest(a.destinataire_ids)
              FROM commande_lignes l JOIN commande_activites a ON a.id = l.activite_id
              WHERE v_commande.directe AND l.commande_id = NEW.objet_id
        UNION SELECT auteur_id FROM notes_partagees
              WHERE objet_type = 'commande' AND objet_id = NEW.objet_id AND actif
      ) x
      WHERE d IS NOT NULL AND d <> NEW.auteur_id
    LOOP
      v_lien := CASE WHEN v_dest = v_commande.demandeur_id THEN '/gmao/commander?onglet=mes_commandes'
                     ELSE '/gmao/commander' END;
      PERFORM notifier_push(v_dest, v_titre, v_corps, v_lien);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;