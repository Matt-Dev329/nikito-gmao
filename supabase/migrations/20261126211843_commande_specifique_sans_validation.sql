-- Commande spécifique (article hors catalogue) : une activité « sans
-- validation » (ex. Arcade) part directement, comme une commande catalogue
-- (directe, validée, envoyée à ses destinataires).
CREATE OR REPLACE FUNCTION public.passer_commande_specifique(p_parc_id uuid, p_activite_id uuid, p_designation text, p_quantite integer, p_unite text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_lien text DEFAULT NULL::text, p_commentaire text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_role text := current_role_code()::text;
  v_activite_nom text;
  v_directe boolean;
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
  SELECT nom, coalesce(sans_validation, false) INTO v_activite_nom, v_directe
  FROM commande_activites WHERE id = p_activite_id AND actif;
  IF v_activite_nom IS NULL THEN
    RAISE EXCEPTION 'Activité introuvable';
  END IF;

  INSERT INTO commandes (demandeur_id, parc_id, commentaire, directe, statut, traitee_le)
  VALUES (v_utilisateur_id, p_parc_id, NULLIF(trim(p_commentaire), ''), v_directe,
          CASE WHEN v_directe THEN 'validee' ELSE 'demandee' END,
          CASE WHEN v_directe THEN now() END)
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

  RETURN jsonb_build_object('id', v_commande_id, 'numero', v_numero, 'directe', v_directe)
      || CASE WHEN v_directe THEN jsonb_build_object('numero_directe', v_numero) ELSE '{}'::jsonb END;
END;
$function$;
