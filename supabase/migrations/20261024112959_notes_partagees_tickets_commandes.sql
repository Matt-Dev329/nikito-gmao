-- Notes partagées sur les tickets et les commandes : tout utilisateur qui
-- voit le ticket ou la commande peut lire ses notes et en ajouter. Chacun
-- modifie ou retire les siennes (le chef d'équipe peut retirer toute note).
-- Les personnes concernées sont prévenues (push) : pour un ticket, le
-- déclarant, le technicien assigné et ceux qui ont déjà écrit ; pour une
-- commande, le demandeur, les destinataires d'une commande directe, le chef
-- d'équipe et ceux qui ont déjà écrit.

CREATE TABLE public.notes_partagees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet_type text NOT NULL CHECK (objet_type IN ('ticket', 'commande')),
  objet_id uuid NOT NULL,
  auteur_id uuid NOT NULL DEFAULT current_utilisateur_id() REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  texte text NOT NULL CHECK (length(trim(texte)) > 0 AND length(texte) <= 4000),
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz
);
CREATE INDEX notes_partagees_objet_idx ON public.notes_partagees (objet_type, objet_id, cree_le);
CREATE INDEX notes_partagees_auteur_idx ON public.notes_partagees (auteur_id);

-- Visible si le ticket / la commande l'est pour l'utilisateur (RLS de la table d'origine)
CREATE OR REPLACE FUNCTION public.objet_note_visible(p_type text, p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_type
    WHEN 'ticket' THEN EXISTS (SELECT 1 FROM incidents WHERE id = p_id)
    WHEN 'commande' THEN EXISTS (SELECT 1 FROM commandes WHERE id = p_id)
    ELSE false
  END;
$function$;
REVOKE ALL ON FUNCTION public.objet_note_visible(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.objet_note_visible(text, uuid) TO authenticated;

ALTER TABLE public.notes_partagees ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_partagees_lecture ON public.notes_partagees
  FOR SELECT TO authenticated
  USING (objet_note_visible(objet_type, objet_id));
CREATE POLICY notes_partagees_ajout ON public.notes_partagees
  FOR INSERT TO authenticated
  WITH CHECK (auteur_id = (SELECT current_utilisateur_id()) AND actif AND objet_note_visible(objet_type, objet_id));
CREATE POLICY notes_partagees_modification ON public.notes_partagees
  FOR UPDATE TO authenticated
  USING (auteur_id = (SELECT current_utilisateur_id()) OR (SELECT current_role_code()) = 'chef_maintenance')
  WITH CHECK (auteur_id = (SELECT current_utilisateur_id()) OR (SELECT current_role_code()) = 'chef_maintenance');

REVOKE ALL ON public.notes_partagees FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.notes_partagees TO authenticated;

-- Seuls le texte et le retrait changent ; date de modification tenue à jour
CREATE OR REPLACE FUNCTION public.fn_notes_partagees_maj()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.objet_type IS DISTINCT FROM OLD.objet_type OR NEW.auteur_id IS DISTINCT FROM OLD.auteur_id
     OR NEW.cree_le IS DISTINCT FROM OLD.cree_le THEN
    RAISE EXCEPTION 'Seul le texte d''une note peut être modifié';
  END IF;
  IF NEW.texte IS DISTINCT FROM OLD.texte THEN
    IF OLD.auteur_id IS DISTINCT FROM current_utilisateur_id() THEN
      RAISE EXCEPTION 'Tu ne peux modifier que tes propres notes' USING ERRCODE = '42501';
    END IF;
    NEW.modifie_le := now();
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER notes_partagees_maj BEFORE UPDATE ON public.notes_partagees
  FOR EACH ROW EXECUTE FUNCTION fn_notes_partagees_maj();

-- Notification des personnes concernées
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
  v_ticket incidents%ROWTYPE;
  v_commande commandes%ROWTYPE;
BEGIN
  SELECT trim(prenom || ' ' || nom) INTO v_auteur FROM utilisateurs WHERE id = NEW.auteur_id;

  IF NEW.objet_type = 'ticket' THEN
    SELECT * INTO v_ticket FROM incidents WHERE id = NEW.objet_id;
    IF v_ticket.id IS NULL THEN RETURN NEW; END IF;
    v_titre := 'Note · ' || v_ticket.numero_bt || COALESCE(' · ' || v_auteur, '');
    v_lien := '/gmao/operations/' || v_ticket.numero_bt;
    FOR v_dest IN
      SELECT DISTINCT d FROM (
        SELECT v_ticket.declare_par_id AS d
        UNION SELECT v_ticket.assigne_a_id
        UNION SELECT auteur_id FROM notes_partagees
              WHERE objet_type = 'ticket' AND objet_id = NEW.objet_id AND actif
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
              WHERE u.actif AND r.code = 'chef_maintenance'
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
REVOKE ALL ON FUNCTION public.fn_push_note_partagee() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notes_partagees_push AFTER INSERT ON public.notes_partagees
  FOR EACH ROW EXECUTE FUNCTION fn_push_note_partagee();

-- Commande modifiée (remplacée par une nouvelle) : ses notes la suivent
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
  v_chef boolean := (SELECT current_role_code()) = 'chef_maintenance';
  v_destinataire boolean;
  v_qui text;
BEGIN
  SELECT * INTO v_ancienne FROM commandes WHERE id = p_commande_id FOR UPDATE;
  IF v_ancienne.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;
  v_destinataire := v_ancienne.directe AND est_destinataire_commande(p_commande_id);
  IF NOT (v_chef OR v_destinataire) THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut modifier la commande d''un autre' USING ERRCODE = '42501';
  END IF;
  IF v_chef AND v_ancienne.statut NOT IN ('demandee', 'validee')
     AND NOT (v_destinataire AND v_ancienne.statut = 'commandee') THEN
    RAISE EXCEPTION 'Commande déjà passée : elle ne peut plus être modifiée';
  END IF;
  IF NOT v_chef AND v_ancienne.statut NOT IN ('validee', 'commandee') THEN
    RAISE EXCEPTION 'Commande livrée ou clôturée : elle ne peut plus être modifiée';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'Lignes invalides';
  END IF;

  -- Destinataire : ajouts limités aux activités dont il reçoit les commandes
  IF NOT v_chef AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lignes) e
    JOIN commande_produits p ON p.id = nullif(e->>'produit_id', '')::uuid
    JOIN commande_activites a ON a.id = p.activite_id
    WHERE NOT (e ? 'ligne_id' AND nullif(e->>'ligne_id', '') IS NOT NULL)
      AND NOT (v_moi = ANY (a.destinataire_ids))
  ) THEN
    RAISE EXCEPTION 'Tu ne peux ajouter que des articles de ton activité (ex. Arcade)' USING ERRCODE = '42501';
  END IF;

  INSERT INTO commandes (demandeur_id, parc_id, statut, commentaire, traitee_par_id, traitee_le, directe)
  VALUES (v_ancienne.demandeur_id, v_ancienne.parc_id, v_ancienne.statut, v_ancienne.commentaire,
          v_ancienne.traitee_par_id, v_ancienne.traitee_le, v_ancienne.directe)
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

  -- Les notes suivent la commande
  UPDATE notes_partagees SET objet_id = v_id WHERE objet_type = 'commande' AND objet_id = p_commande_id;

  v_qui := CASE WHEN v_chef THEN 'le chef d''équipe'
                ELSE coalesce((SELECT prenom FROM utilisateurs WHERE id = v_moi), 'le préparateur') END;

  UPDATE commandes
  SET statut = 'annulee',
      motif_refus = 'Remplacée par ' || v_numero || ' (modifiée par ' || v_qui || ')',
      traitee_par_id = v_moi,
      traitee_le = now()
  WHERE id = p_commande_id;

  IF v_ancienne.demandeur_id IS DISTINCT FROM v_moi THEN
    PERFORM notifier_push(v_ancienne.demandeur_id,
      'Commande ' || v_ancienne.numero || ' modifiée',
      initcap(left(v_qui, 1)) || substr(v_qui, 2) || ' a modifié ta commande : elle devient ' || v_numero || '.',
      '/gmao/commander?onglet=mes_commandes');
  END IF;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$function$;
