-- Commandes « Arcade » (consommables : bonbons, peluches, boules…) : pas de
-- validation, la commande part directement aux personnes désignées sur
-- l'activité (Lili-Marie et Joachim), le chef d'équipe en copie.

ALTER TABLE public.commande_activites
  ADD COLUMN IF NOT EXISTS sans_validation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destinataire_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS directe boolean NOT NULL DEFAULT false;

INSERT INTO public.commande_activites (nom, description, ordre, sans_validation, destinataire_ids)
SELECT 'Arcade', 'Consommables des arcades (lots, boules, eau…) — commande directe, sans validation',
       coalesce((SELECT max(ordre) FROM public.commande_activites), 0) + 1, true,
       coalesce((SELECT array_agg(id ORDER BY prenom) FROM public.utilisateurs
                 WHERE lower(email) IN ('lilimarie.pellerin@ja-fg.com', 'joachim.miloche@ja-fg.com')), '{}')
WHERE NOT EXISTS (SELECT 1 FROM public.commande_activites WHERE nom = 'Arcade');

INSERT INTO public.commande_produits (activite_id, nom, unite, ordre)
SELECT a.id, p.nom, 'unité', p.ordre
FROM public.commande_activites a
CROSS JOIN (VALUES
  (1, 'Bonbons'),
  (2, 'Sucettes'),
  (3, 'Mix jouets'),
  (4, 'Peluchons'),
  (5, 'Canards'),
  (6, 'Peluches licence petite'),
  (7, 'Peluches licence grande'),
  (8, 'Eau déminéralisée'),
  (9, 'Balles rebondissantes'),
  (10, 'Balles en mousse'),
  (11, 'Boules 65 mm'),
  (12, 'Boules 90/100 mm'),
  (13, 'Boules rainbow multicolores'),
  (14, 'Boules rainbow or')
) AS p(ordre, nom)
WHERE a.nom = 'Arcade'
  AND NOT EXISTS (SELECT 1 FROM public.commande_produits x WHERE x.activite_id = a.id AND x.nom = p.nom);

-- Passer commande : les articles des activités « sans validation » partent dans
-- une commande à part, directement validée ; le reste suit le circuit habituel.
CREATE OR REPLACE FUNCTION public.passer_commande(p_parc_id uuid, p_lignes jsonb, p_commentaire text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_role text := current_role_code()::text;
  v_project_url text := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
  v_directe boolean;
  v_commande_id uuid;
  v_numero text;
  v_nb_lignes integer;
  v_total integer := 0;
  v_resultat jsonb := '{}'::jsonb;
  v_panier jsonb;
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

  -- Panier regroupé par produit, avec le mode de l'activité (directe ou non)
  SELECT coalesce(jsonb_agg(jsonb_build_object('produit_id', l.produit_id, 'quantite', l.quantite, 'directe', a.sans_validation)), '[]'::jsonb)
  INTO v_panier
  FROM (
    SELECT (e->>'produit_id')::uuid AS produit_id, sum((e->>'quantite')::integer)::integer AS quantite
    FROM jsonb_array_elements(p_lignes) e
    GROUP BY 1
  ) l
  JOIN commande_produits p ON p.id = l.produit_id AND p.actif
  JOIN commande_activites a ON a.id = p.activite_id AND a.actif
  WHERE l.quantite > 0;

  -- Commande habituelle (à valider) puis commande directe (sans validation)
  FOREACH v_directe IN ARRAY ARRAY[false, true] LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(v_panier) AS l(produit_id uuid, quantite integer, directe boolean) WHERE l.directe = v_directe);

    INSERT INTO commandes (demandeur_id, parc_id, commentaire, directe, statut, traitee_le)
    VALUES (v_utilisateur_id, p_parc_id, NULLIF(trim(p_commentaire), ''), v_directe,
            CASE WHEN v_directe THEN 'validee' ELSE 'demandee' END,
            CASE WHEN v_directe THEN now() END)
    RETURNING id, numero INTO v_commande_id, v_numero;

    INSERT INTO commande_lignes (commande_id, produit_id, piece_id, activite_id, activite_nom, produit_nom, reference, unite, quantite, prix_unitaire)
    SELECT v_commande_id, p.id, p.piece_id, a.id, a.nom, p.nom, p.reference, p.unite, l.quantite, p.prix_unitaire
    FROM jsonb_to_recordset(v_panier) AS l(produit_id uuid, quantite integer, directe boolean)
    JOIN commande_produits p ON p.id = l.produit_id
    JOIN commande_activites a ON a.id = p.activite_id
    WHERE l.directe = v_directe;
    GET DIAGNOSTICS v_nb_lignes = ROW_COUNT;
    v_total := v_total + v_nb_lignes;

    UPDATE commandes SET total_estime = (
      SELECT sum(quantite * prix_unitaire) FROM commande_lignes WHERE commande_id = v_commande_id
    ) WHERE id = v_commande_id;

    -- Email (asynchrone, envoyé après le commit)
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

    IF v_directe THEN
      v_resultat := v_resultat || jsonb_build_object('numero_directe', v_numero);
    END IF;
    -- id / numero : la commande à valider si elle existe, sinon la directe
    IF NOT (v_resultat ? 'numero') THEN
      v_resultat := v_resultat || jsonb_build_object('id', v_commande_id, 'numero', v_numero);
    END IF;
  END LOOP;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Aucun produit valide dans le panier';
  END IF;

  RETURN v_resultat;
END;
$function$;
