/*
  # Module Commandes (catalogue activités → produits, panier, commandes)

  1. Tables
    - `commandes_gestionnaires` : qui gère le catalogue et reçoit les commandes
      (notification cloche + email). Seed : ryad.neki@nikito.com.
    - `commande_activites` : activités du catalogue (Karting, Arcade, Bar…)
    - `commande_produits` : produits rattachés à une activité
    - `commandes` : en-tête de commande (demandeur, parc, statut)
    - `commande_lignes` : lignes, avec instantané nom / référence / prix

  2. Accès
    - Feature flag `commandes` créé avec roles_autorises = '{}' : pendant la
      mise en place du catalogue, seuls les gestionnaires voient l'onglet.
      Pour l'ouvrir : roles_autorises = chef_maintenance, directeur_parc,
      technicien, manager_parc (page Administration IT).
    - Catalogue : lecture pour qui peut commander, écriture gestionnaires.
    - Commandes : le demandeur voit les siennes, les gestionnaires voient tout.
      Création uniquement via la RPC `passer_commande` (SECURITY DEFINER).

  3. Notification
    - Email : la RPC appelle l'edge function `notifier-commande` via pg_net.

  4. Lien avec le stock
    - `commande_produits.piece_id` : pièce du stock (pieces_detachees) liée.
    - Quand une commande passe en `livree`, chaque ligne entre en stock
      (trigger `fn_commande_livree_entree_stock`). Produit sans pièce liée →
      on reprend la pièce de même référence, sinon on la crée et on la lie.
      Garde-fou : `commandes.stock_entre_le` empêche une double entrée.
*/

-- ---------------------------------------------------------------------------
-- 1. Gestionnaires
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commandes_gestionnaires (
  utilisateur_id uuid PRIMARY KEY REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  notifier_email boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commandes_gestionnaires ENABLE ROW LEVEL SECURITY;

INSERT INTO public.commandes_gestionnaires (utilisateur_id)
SELECT id FROM public.utilisateurs WHERE lower(email) = 'ryad.neki@nikito.com'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.est_gestionnaire_commandes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM commandes_gestionnaires g
    WHERE g.utilisateur_id = current_utilisateur_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.peut_commander()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT est_gestionnaire_commandes() OR EXISTS (
    SELECT 1 FROM feature_flags f
    WHERE f.feature_code = 'commandes'
      AND f.actif_global
      AND current_role_code()::text = ANY (f.roles_autorises)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.est_gestionnaire_commandes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.peut_commander() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_gestionnaire_commandes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_commander() TO authenticated;

CREATE POLICY "Gestionnaires lisent les gestionnaires"
  ON public.commandes_gestionnaires FOR SELECT TO authenticated
  USING ((SELECT est_gestionnaire_commandes()));

-- ---------------------------------------------------------------------------
-- 2. Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commande_activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  description text,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commande_activites ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.commande_produits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activite_id uuid NOT NULL REFERENCES public.commande_activites(id) ON DELETE CASCADE,
  nom text NOT NULL,
  reference text,
  description text,
  unite text NOT NULL DEFAULT 'unité',
  prix_unitaire numeric(10,2) CHECK (prix_unitaire IS NULL OR prix_unitaire >= 0),
  photo_url text,
  piece_id uuid REFERENCES public.pieces_detachees(id) ON DELETE SET NULL,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commande_produits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commande_produits_activite ON public.commande_produits(activite_id);
CREATE INDEX IF NOT EXISTS idx_commande_produits_piece ON public.commande_produits(piece_id);

CREATE POLICY "Lecture activités si accès commandes"
  ON public.commande_activites FOR SELECT TO authenticated
  USING ((SELECT peut_commander()));
CREATE POLICY "Gestionnaires créent les activités"
  ON public.commande_activites FOR INSERT TO authenticated
  WITH CHECK ((SELECT est_gestionnaire_commandes()));
CREATE POLICY "Gestionnaires modifient les activités"
  ON public.commande_activites FOR UPDATE TO authenticated
  USING ((SELECT est_gestionnaire_commandes()))
  WITH CHECK ((SELECT est_gestionnaire_commandes()));
CREATE POLICY "Gestionnaires suppriment les activités"
  ON public.commande_activites FOR DELETE TO authenticated
  USING ((SELECT est_gestionnaire_commandes()));

CREATE POLICY "Lecture produits si accès commandes"
  ON public.commande_produits FOR SELECT TO authenticated
  USING ((SELECT peut_commander()));
CREATE POLICY "Gestionnaires créent les produits"
  ON public.commande_produits FOR INSERT TO authenticated
  WITH CHECK ((SELECT est_gestionnaire_commandes()));
CREATE POLICY "Gestionnaires modifient les produits"
  ON public.commande_produits FOR UPDATE TO authenticated
  USING ((SELECT est_gestionnaire_commandes()))
  WITH CHECK ((SELECT est_gestionnaire_commandes()));
CREATE POLICY "Gestionnaires suppriment les produits"
  ON public.commande_produits FOR DELETE TO authenticated
  USING ((SELECT est_gestionnaire_commandes()));

-- ---------------------------------------------------------------------------
-- 3. Commandes
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.commandes_numero_seq;

CREATE TABLE IF NOT EXISTS public.commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE
    DEFAULT ('CMD-' || lpad(nextval('public.commandes_numero_seq')::text, 5, '0')),
  demandeur_id uuid NOT NULL REFERENCES public.utilisateurs(id),
  parc_id uuid NOT NULL REFERENCES public.parcs(id),
  statut text NOT NULL DEFAULT 'demandee'
    CHECK (statut IN ('demandee', 'validee', 'commandee', 'livree', 'refusee', 'annulee')),
  commentaire text,
  motif_refus text,
  total_estime numeric(12,2),
  traitee_par_id uuid REFERENCES public.utilisateurs(id),
  traitee_le timestamptz,
  email_envoye_le timestamptz,
  stock_entre_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commandes_demandeur ON public.commandes(demandeur_id);
CREATE INDEX IF NOT EXISTS idx_commandes_parc ON public.commandes(parc_id);
CREATE INDEX IF NOT EXISTS idx_commandes_traitee_par ON public.commandes(traitee_par_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON public.commandes(statut);

CREATE TABLE IF NOT EXISTS public.commande_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes(id) ON DELETE CASCADE,
  produit_id uuid REFERENCES public.commande_produits(id) ON DELETE SET NULL,
  piece_id uuid REFERENCES public.pieces_detachees(id) ON DELETE SET NULL,
  activite_nom text,
  produit_nom text NOT NULL,
  reference text,
  unite text NOT NULL DEFAULT 'unité',
  quantite integer NOT NULL CHECK (quantite > 0),
  prix_unitaire numeric(10,2)
);
ALTER TABLE public.commande_lignes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commande_lignes_commande ON public.commande_lignes(commande_id);
CREATE INDEX IF NOT EXISTS idx_commande_lignes_produit ON public.commande_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_commande_lignes_piece ON public.commande_lignes(piece_id);

CREATE POLICY "Demandeur ou gestionnaire lit les commandes"
  ON public.commandes FOR SELECT TO authenticated
  USING (
    demandeur_id = (SELECT current_utilisateur_id())
    OR (SELECT est_gestionnaire_commandes())
  );
CREATE POLICY "Gestionnaires traitent les commandes"
  ON public.commandes FOR UPDATE TO authenticated
  USING ((SELECT est_gestionnaire_commandes()))
  WITH CHECK ((SELECT est_gestionnaire_commandes()));

CREATE POLICY "Lecture des lignes selon la commande"
  ON public.commande_lignes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commandes c
    WHERE c.id = commande_lignes.commande_id
      AND (c.demandeur_id = (SELECT current_utilisateur_id())
           OR (SELECT est_gestionnaire_commandes()))
  ));

-- ---------------------------------------------------------------------------
-- 4. RPC : passer une commande (panier → commande + lignes + email)
--    p_lignes = [{ "produit_id": uuid, "quantite": int }, …]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.passer_commande(
  p_parc_id uuid,
  p_lignes jsonb,
  p_commentaire text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_role text := current_role_code()::text;
  v_commande_id uuid;
  v_numero text;
  v_nb_lignes integer;
  v_project_url text := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
BEGIN
  IF v_utilisateur_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF NOT peut_commander() THEN
    RAISE EXCEPTION 'Accès aux commandes non autorisé';
  END IF;
  IF NOT (
    p_parc_id = ANY (current_parc_ids())
    OR v_role IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it')
    OR est_gestionnaire_commandes()
  ) THEN
    RAISE EXCEPTION 'Parc non autorisé';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  INSERT INTO commandes (demandeur_id, parc_id, commentaire)
  VALUES (v_utilisateur_id, p_parc_id, NULLIF(trim(p_commentaire), ''))
  RETURNING id, numero INTO v_commande_id, v_numero;

  INSERT INTO commande_lignes (commande_id, produit_id, piece_id, activite_nom, produit_nom, reference, unite, quantite, prix_unitaire)
  SELECT v_commande_id, p.id, p.piece_id, a.nom, p.nom, p.reference, p.unite, l.quantite, p.prix_unitaire
  FROM (
    SELECT (e->>'produit_id')::uuid AS produit_id, sum((e->>'quantite')::integer)::integer AS quantite
    FROM jsonb_array_elements(p_lignes) e
    GROUP BY 1
  ) l
  JOIN commande_produits p ON p.id = l.produit_id AND p.actif
  JOIN commande_activites a ON a.id = p.activite_id AND a.actif
  WHERE l.quantite > 0;

  GET DIAGNOSTICS v_nb_lignes = ROW_COUNT;
  IF v_nb_lignes = 0 THEN
    RAISE EXCEPTION 'Aucun produit valide dans le panier';
  END IF;

  UPDATE commandes SET total_estime = (
    SELECT sum(quantite * prix_unitaire) FROM commande_lignes WHERE commande_id = v_commande_id
  ) WHERE id = v_commande_id;

  -- Email aux gestionnaires (asynchrone, envoyé après le commit)
  BEGIN
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/notifier-commande',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('commande_id', v_commande_id),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN OTHERS THEN
    -- La commande ne doit jamais échouer à cause de l'email
    NULL;
  END;

  RETURN jsonb_build_object('id', v_commande_id, 'numero', v_numero);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.passer_commande(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passer_commande(uuid, jsonb, text) TO authenticated;

-- Le demandeur peut annuler sa commande tant qu'elle n'est pas traitée
CREATE OR REPLACE FUNCTION public.annuler_commande(p_commande_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE commandes
  SET statut = 'annulee', traitee_le = now(), traitee_par_id = current_utilisateur_id()
  WHERE id = p_commande_id
    AND demandeur_id = current_utilisateur_id()
    AND statut = 'demandee';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable ou déjà traitée';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.annuler_commande(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_commande(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Livraison → entrée en stock automatique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_commande_livree_entree_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  l record;
  v_piece_id uuid;
  v_reference text;
BEGIN
  IF NEW.statut <> 'livree' OR OLD.statut = 'livree' OR NEW.stock_entre_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR l IN
    SELECT cl.*, cp.piece_id AS piece_produit
    FROM commande_lignes cl
    LEFT JOIN commande_produits cp ON cp.id = cl.produit_id
    WHERE cl.commande_id = NEW.id
  LOOP
    v_piece_id := COALESCE(l.piece_id, l.piece_produit);

    IF v_piece_id IS NULL THEN
      -- Pas de pièce liée : on reprend celle de même référence, sinon on la crée
      v_reference := COALESCE(NULLIF(trim(l.reference), ''),
                              'CMD-' || left(COALESCE(l.produit_id, l.id)::text, 8));
      SELECT id INTO v_piece_id FROM pieces_detachees WHERE reference = v_reference;
      IF v_piece_id IS NULL THEN
        INSERT INTO pieces_detachees (reference, nom, stock_actuel, stock_min, prix_unitaire_ht)
        VALUES (v_reference, l.produit_nom, 0, 0, l.prix_unitaire)
        RETURNING id INTO v_piece_id;
      END IF;
      IF l.produit_id IS NOT NULL THEN
        UPDATE commande_produits SET piece_id = v_piece_id
        WHERE id = l.produit_id AND piece_id IS NULL;
      END IF;
      UPDATE commande_lignes SET piece_id = v_piece_id WHERE id = l.id;
    END IF;

    UPDATE pieces_detachees
    SET stock_actuel = stock_actuel + l.quantite, modifie_le = now()
    WHERE id = v_piece_id;
  END LOOP;

  NEW.stock_entre_le := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_commande_livree_entree_stock() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_commande_livree_entree_stock
  BEFORE UPDATE OF statut ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.fn_commande_livree_entree_stock();

-- ---------------------------------------------------------------------------
-- 6. Feature flag (onglet masqué à tous sauf gestionnaires au départ)
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_flags (feature_code, feature_label, description, ordre, actif_global, roles_autorises)
VALUES ('commandes', 'Commander', 'Catalogue produits par activité, panier et demandes de commande',
        (SELECT COALESCE(max(ordre), 0) + 1 FROM public.feature_flags), true, '{}')
ON CONFLICT (feature_code) DO NOTHING;
