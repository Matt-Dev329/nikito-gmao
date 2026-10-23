-- Suivi des commandes directes (activités « sans validation », ex. Arcade)
-- par leurs destinataires (Lili-Marie, Joachim) : ils voient ces commandes et
-- les marquent « commandée » puis « livrée ». Le demandeur est prévenu à
-- chaque étape (trigger trg_push_commande).

CREATE OR REPLACE FUNCTION public.est_destinataire_commande(p_commande_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM commandes c
    JOIN commande_lignes l ON l.commande_id = c.id
    JOIN commande_activites a ON a.id = l.activite_id
    WHERE c.id = p_commande_id
      AND c.directe
      AND current_utilisateur_id() = ANY (a.destinataire_ids)
  );
$function$;
REVOKE ALL ON FUNCTION public.est_destinataire_commande(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_destinataire_commande(uuid) TO authenticated;

ALTER POLICY "Demandeur ou gestionnaire lit les commandes" ON public.commandes
  USING ((demandeur_id = (SELECT current_utilisateur_id()))
         OR (SELECT est_gestionnaire_commandes())
         OR (directe AND est_destinataire_commande(id)));

ALTER POLICY "Lecture des lignes selon la commande" ON public.commande_lignes
  USING (EXISTS (SELECT 1 FROM commandes c
                 WHERE c.id = commande_lignes.commande_id
                   AND ((c.demandeur_id = (SELECT current_utilisateur_id()))
                        OR (SELECT est_gestionnaire_commandes())
                        OR (c.directe AND est_destinataire_commande(c.id)))));

CREATE OR REPLACE FUNCTION public.avancer_commande_directe(p_commande_id uuid, p_statut text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_commande record;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  SELECT id, statut, directe INTO v_commande FROM commandes WHERE id = p_commande_id FOR UPDATE;
  IF NOT FOUND OR NOT v_commande.directe THEN
    RAISE EXCEPTION 'Commande directe introuvable';
  END IF;
  IF NOT (est_destinataire_commande(p_commande_id) OR est_gestionnaire_commandes()) THEN
    RAISE EXCEPTION 'Réservé aux destinataires de la commande' USING ERRCODE = '42501';
  END IF;
  IF NOT ((p_statut = 'commandee' AND v_commande.statut = 'validee')
          OR (p_statut = 'livree' AND v_commande.statut IN ('validee', 'commandee'))) THEN
    RAISE EXCEPTION 'Étape impossible depuis le statut « % »', v_commande.statut;
  END IF;

  UPDATE commandes
     SET statut = p_statut, traitee_le = now(), traitee_par_id = v_moi
   WHERE id = p_commande_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.avancer_commande_directe(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avancer_commande_directe(uuid, text) TO authenticated;
