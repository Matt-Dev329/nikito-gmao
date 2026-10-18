-- Le chef d'équipe peut modifier la commande d'un autre (quantités, articles
-- retirés ou ajoutés) tant qu'elle n'est pas commandée. La commande modifiée
-- remplace l'ancienne (même demandeur, même parc, même statut) ; l'ancienne
-- est annulée avec la mention « Remplacée par CMD-… » : l'historique est gardé.
CREATE OR REPLACE FUNCTION public.modifier_commande(p_commande_id uuid, p_lignes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ancienne commandes%ROWTYPE;
  v_id uuid;
  v_numero text;
  v_nb int;
  v_moi uuid := (SELECT current_utilisateur_id());
BEGIN
  IF (SELECT current_role_code()) <> 'chef_maintenance' THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut modifier la commande d''un autre' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ancienne FROM commandes WHERE id = p_commande_id FOR UPDATE;
  IF v_ancienne.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;
  IF v_ancienne.statut NOT IN ('demandee', 'validee') THEN
    RAISE EXCEPTION 'Commande déjà passée : elle ne peut plus être modifiée';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'Lignes invalides';
  END IF;

  INSERT INTO commandes (demandeur_id, parc_id, statut, commentaire, traitee_par_id, traitee_le)
  VALUES (v_ancienne.demandeur_id, v_ancienne.parc_id, v_ancienne.statut, v_ancienne.commentaire,
          v_ancienne.traitee_par_id, v_ancienne.traitee_le)
  RETURNING id, numero INTO v_id, v_numero;

  -- Lignes existantes gardées (avec leur nouvelle quantité)
  INSERT INTO commande_lignes (commande_id, produit_id, piece_id, activite_nom, produit_nom, reference, unite,
                               quantite, prix_unitaire, specifique, activite_id, lien)
  SELECT v_id, l.produit_id, l.piece_id, l.activite_nom, l.produit_nom, l.reference, l.unite,
         x.quantite, l.prix_unitaire, l.specifique, l.activite_id, l.lien
  FROM (SELECT (e->>'ligne_id')::uuid AS ligne_id, sum((e->>'quantite')::int)::int AS quantite
        FROM jsonb_array_elements(p_lignes) e
        WHERE e ? 'ligne_id' AND nullif(e->>'ligne_id', '') IS NOT NULL
        GROUP BY 1) x
  JOIN commande_lignes l ON l.id = x.ligne_id AND l.commande_id = p_commande_id
  WHERE x.quantite > 0;

  -- Produits du catalogue ajoutés
  INSERT INTO commande_lignes (commande_id, produit_id, piece_id, activite_nom, produit_nom, reference, unite,
                               quantite, prix_unitaire, activite_id)
  SELECT v_id, p.id, p.piece_id, a.nom, p.nom, p.reference, p.unite, x.quantite, p.prix_unitaire, a.id
  FROM (SELECT (e->>'produit_id')::uuid AS produit_id, sum((e->>'quantite')::int)::int AS quantite
        FROM jsonb_array_elements(p_lignes) e
        WHERE NOT (e ? 'ligne_id' AND nullif(e->>'ligne_id', '') IS NOT NULL)
          AND nullif(e->>'produit_id', '') IS NOT NULL
        GROUP BY 1) x
  JOIN commande_produits p ON p.id = x.produit_id AND p.actif
  JOIN commande_activites a ON a.id = p.activite_id AND a.actif
  WHERE x.quantite > 0;

  SELECT count(*) INTO v_nb FROM commande_lignes WHERE commande_id = v_id;
  IF v_nb = 0 THEN
    RAISE EXCEPTION 'La commande ne peut pas être vide : annule-la plutôt';
  END IF;

  UPDATE commandes SET total_estime = (
    SELECT sum(quantite * coalesce(prix_unitaire, 0)) FROM commande_lignes WHERE commande_id = v_id
  ) WHERE id = v_id;

  UPDATE commandes
  SET statut = 'annulee',
      motif_refus = 'Remplacée par ' || v_numero || ' (modifiée par le chef d''équipe)',
      traitee_par_id = v_moi,
      traitee_le = now()
  WHERE id = p_commande_id;

  IF v_ancienne.demandeur_id IS DISTINCT FROM v_moi THEN
    PERFORM notifier_push(v_ancienne.demandeur_id,
      'Commande ' || v_ancienne.numero || ' modifiée',
      'Le chef d''équipe a modifié ta commande : elle devient ' || v_numero || '.',
      '/gmao/commander?onglet=mes_commandes');
  END IF;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$function$;
REVOKE ALL ON FUNCTION public.modifier_commande(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_commande(uuid, jsonb) TO authenticated;
