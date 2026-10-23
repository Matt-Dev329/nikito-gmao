-- Le chef d'équipe est prévenu de tout ce qui se passe sur les commandes :
-- nouvelle commande (comme avant), et désormais chaque changement fait par
-- quelqu'un d'autre (validée, commandée, livrée, refusée, annulée, modifiée),
-- avec le nom de la personne. Le demandeur reste prévenu comme avant.

CREATE OR REPLACE FUNCTION public.fn_push_commande()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parc text;
  v_chef record;
  v_libelle text;
  v_moi uuid := current_utilisateur_id();
  v_acteur text;
  v_titre text;
  v_corps text;
BEGIN
  SELECT nom INTO v_parc FROM parcs WHERE id = NEW.parc_id;

  IF TG_OP = 'INSERT' THEN
    FOR v_chef IN
      SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
      WHERE u.actif AND r.code = 'chef_maintenance' AND u.id IS DISTINCT FROM NEW.demandeur_id
    LOOP
      PERFORM notifier_push(v_chef.id, 'Nouvelle commande · ' || NEW.numero,
        COALESCE(v_parc, '') , '/gmao/commander?onglet=a_traiter');
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  v_libelle := CASE
    WHEN NEW.statut = 'annulee' AND NEW.motif_refus LIKE 'Remplacée par%' THEN 'modifiée'
    WHEN NEW.statut = 'validee' THEN 'validée'
    WHEN NEW.statut = 'commandee' THEN 'commandée'
    WHEN NEW.statut = 'livree' THEN 'livrée'
    WHEN NEW.statut = 'refusee' THEN 'refusée'
    WHEN NEW.statut = 'annulee' THEN 'annulée'
    ELSE NULL END;
  IF v_libelle IS NULL THEN
    RETURN NEW;
  END IF;

  -- Demandeur : comme avant (hors annulation, qu'il fait lui-même ou qui suit une
  -- modification ; un chef d'équipe demandeur reçoit le message « chef » ci-dessous)
  IF NEW.demandeur_id IS DISTINCT FROM v_moi AND NEW.statut <> 'annulee'
     AND NOT EXISTS (SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
                     WHERE u.id = NEW.demandeur_id AND r.code = 'chef_maintenance') THEN
    PERFORM notifier_push(NEW.demandeur_id, 'Commande ' || NEW.numero || ' ' || v_libelle,
      CASE WHEN NEW.statut = 'refusee' AND NEW.motif_refus IS NOT NULL THEN 'Motif : ' || NEW.motif_refus ELSE COALESCE(v_parc, '') END,
      '/gmao/commander?onglet=mes_commandes');
  END IF;

  -- Chef d'équipe : tout changement fait par quelqu'un d'autre
  SELECT trim(prenom || ' ' || nom) INTO v_acteur FROM utilisateurs WHERE id = v_moi;
  v_titre := 'Commande ' || NEW.numero || ' ' || v_libelle;
  v_corps := concat_ws(' · ', v_parc, CASE WHEN v_acteur IS NOT NULL THEN 'par ' || v_acteur END,
                       CASE WHEN v_libelle = 'modifiée' THEN replace(NEW.motif_refus, 'Remplacée par ', 'devient ') END);
  FOR v_chef IN
    SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.actif AND r.code = 'chef_maintenance'
      AND u.id IS DISTINCT FROM v_moi
  LOOP
    PERFORM notifier_push(v_chef.id, v_titre, v_corps, '/gmao/commander?onglet=a_traiter');
  END LOOP;
  RETURN NEW;
END;
$function$;
