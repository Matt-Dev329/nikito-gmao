/*
  # Commandes spécifiques (article hors catalogue)

  1. commande_lignes : `specifique`, `activite_id`, `lien` (article saisi
     librement, sans produit du catalogue).
  2. RPC `passer_commande_specifique` : crée une commande d'une ligne
     spécifique (mêmes contrôles d'accès et même email que passer_commande).
  3. Trigger `fn_commande_validee_ajout_catalogue` : quand une commande passe
     de « demandee » à « validee », chaque ligne spécifique est ajoutée au
     catalogue de son activité (catégorie « Commandes spécifiques ») — ou
     rattachée à un produit existant de même référence / même nom — et la
     ligne est liée à ce produit. La livraison alimente ensuite le stock
     comme pour toute commande.
*/

ALTER TABLE public.commande_lignes ADD COLUMN IF NOT EXISTS specifique boolean NOT NULL DEFAULT false;
ALTER TABLE public.commande_lignes ADD COLUMN IF NOT EXISTS activite_id uuid REFERENCES public.commande_activites(id) ON DELETE SET NULL;
ALTER TABLE public.commande_lignes ADD COLUMN IF NOT EXISTS lien text;
CREATE INDEX IF NOT EXISTS idx_commande_lignes_activite ON public.commande_lignes(activite_id);

CREATE OR REPLACE FUNCTION public.passer_commande_specifique(
  p_parc_id uuid,
  p_activite_id uuid,
  p_designation text,
  p_quantite integer,
  p_unite text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_lien text DEFAULT NULL,
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
  v_activite_nom text;
  v_commande_id uuid;
  v_numero text;
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
  IF NULLIF(trim(p_designation), '') IS NULL THEN
    RAISE EXCEPTION 'La désignation de l''article est obligatoire';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être supérieure à 0';
  END IF;
  SELECT nom INTO v_activite_nom FROM commande_activites WHERE id = p_activite_id AND actif;
  IF v_activite_nom IS NULL THEN
    RAISE EXCEPTION 'Activité introuvable';
  END IF;

  INSERT INTO commandes (demandeur_id, parc_id, commentaire)
  VALUES (v_utilisateur_id, p_parc_id, NULLIF(trim(p_commentaire), ''))
  RETURNING id, numero INTO v_commande_id, v_numero;

  INSERT INTO commande_lignes (commande_id, specifique, activite_id, activite_nom, produit_nom, reference, unite, quantite, lien)
  VALUES (v_commande_id, true, p_activite_id, v_activite_nom, trim(p_designation),
          NULLIF(trim(p_reference), ''), COALESCE(NULLIF(trim(p_unite), ''), 'unité'), p_quantite,
          NULLIF(trim(p_lien), ''));

  BEGIN
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/notifier-commande',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
      body := jsonb_build_object('commande_id', v_commande_id),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('id', v_commande_id, 'numero', v_numero);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.passer_commande_specifique(uuid, uuid, text, integer, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passer_commande_specifique(uuid, uuid, text, integer, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_commande_validee_ajout_catalogue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  l record;
  v_produit_id uuid;
BEGIN
  IF NEW.statut <> 'validee' OR OLD.statut <> 'demandee' THEN
    RETURN NEW;
  END IF;

  FOR l IN
    SELECT * FROM commande_lignes
    WHERE commande_id = NEW.id AND specifique AND produit_id IS NULL AND activite_id IS NOT NULL
  LOOP
    SELECT id INTO v_produit_id FROM commande_produits
    WHERE activite_id = l.activite_id
      AND ((l.reference IS NOT NULL AND reference = l.reference) OR lower(nom) = lower(l.produit_nom))
    ORDER BY (reference = l.reference) DESC NULLS LAST
    LIMIT 1;

    IF v_produit_id IS NULL THEN
      INSERT INTO commande_produits (activite_id, nom, reference, unite, description, categorie, ordre)
      VALUES (l.activite_id, l.produit_nom, l.reference, l.unite,
              'Ajouté depuis la commande spécifique ' || NEW.numero || COALESCE(' · Lien : ' || l.lien, ''),
              'Commandes spécifiques',
              (SELECT COALESCE(max(ordre), 0) + 1 FROM commande_produits WHERE activite_id = l.activite_id))
      RETURNING id INTO v_produit_id;
    END IF;

    UPDATE commande_lignes SET produit_id = v_produit_id WHERE id = l.id;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_commande_validee_ajout_catalogue() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_commande_validee_ajout_catalogue
  AFTER UPDATE OF statut ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.fn_commande_validee_ajout_catalogue();
