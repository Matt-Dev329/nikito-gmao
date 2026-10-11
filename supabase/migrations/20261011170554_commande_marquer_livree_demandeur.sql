/*
  # Le demandeur peut marquer sa commande « livrée »

  RPC `marquer_commande_livree(p_commande_id)` : le demandeur (ou un chef
  d'équipe) confirme la réception d'une commande validée ou commandée.
  Mêmes effets qu'une livraison saisie par le chef d'équipe : entrée en stock
  (trigger), tickets en attente de cette commande remis « à faire ».
  Les chefs d'équipe sont notifiés (push) de la réception.
*/

CREATE OR REPLACE FUNCTION public.marquer_commande_livree(p_commande_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_commande record;
  v_chef record;
  v_nom text;
BEGIN
  IF v_utilisateur_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT id, numero, statut, demandeur_id INTO v_commande
  FROM commandes WHERE id = p_commande_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;
  IF v_commande.demandeur_id <> v_utilisateur_id AND NOT est_gestionnaire_commandes() THEN
    RAISE EXCEPTION 'Seul le demandeur ou le chef d''équipe peut confirmer la livraison' USING ERRCODE = '42501';
  END IF;
  IF v_commande.statut = 'livree' THEN
    RETURN;
  END IF;
  IF v_commande.statut NOT IN ('validee', 'commandee') THEN
    RAISE EXCEPTION 'La commande doit être validée ou commandée pour être marquée livrée';
  END IF;

  UPDATE commandes
     SET statut = 'livree',
         traitee_le = now(),
         traitee_par_id = v_utilisateur_id
   WHERE id = p_commande_id;

  -- Prévenir les chefs d'équipe que la commande est reçue
  SELECT trim(prenom || ' ' || nom) INTO v_nom FROM utilisateurs WHERE id = v_utilisateur_id;
  FOR v_chef IN
    SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
    WHERE u.actif AND r.code = 'chef_maintenance' AND u.id <> v_utilisateur_id
  LOOP
    PERFORM notifier_push(v_chef.id, 'Commande ' || v_commande.numero || ' reçue',
      'Livraison confirmée par ' || COALESCE(v_nom, 'le demandeur'), '/gmao/commander?onglet=a_traiter');
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marquer_commande_livree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_commande_livree(uuid) TO authenticated;
