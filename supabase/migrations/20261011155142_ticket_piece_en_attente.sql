/*
  # Tickets « Pièce en attente »

  Un ticket bloqué par une pièce à recevoir est rangé dans l'onglet
  « Pièce en attente » (sans être fermé), avec la pièce attendue et,
  facultativement, la commande correspondante.

  - incidents : attente_piece, attente_piece_detail, attente_piece_depuis,
    attente_piece_commande_id.
  - RPC mettre_en_attente_piece / lever_attente_piece.
  - Rangements exclusifs : mettre en attente de pièce retire « extérieur » ;
    confier à un extérieur ou démarrer l'intervention retire « pièce en
    attente ».
  - Quand la commande liée passe « livrée », le ticket sort automatiquement
    de « Pièce en attente » (retour dans « À faire »).
*/

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS attente_piece boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attente_piece_detail text,
  ADD COLUMN IF NOT EXISTS attente_piece_depuis timestamptz,
  ADD COLUMN IF NOT EXISTS attente_piece_commande_id uuid REFERENCES public.commandes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_attente_piece_commande ON public.incidents(attente_piece_commande_id);

CREATE OR REPLACE FUNCTION public.mettre_en_attente_piece(p_incident_id uuid, p_detail text, p_commande_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
  v_statut text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(p_detail), '') IS NULL AND p_commande_id IS NULL THEN
    RAISE EXCEPTION 'Indique la pièce attendue';
  END IF;
  SELECT statut::text INTO v_statut FROM incidents WHERE id = p_incident_id;
  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_statut IN ('resolu', 'ferme') THEN
    RAISE EXCEPTION 'Ce ticket est déjà résolu';
  END IF;

  UPDATE incidents
     SET attente_piece = true,
         attente_piece_detail = NULLIF(trim(p_detail), ''),
         attente_piece_commande_id = p_commande_id,
         attente_piece_depuis = COALESCE(CASE WHEN attente_piece THEN attente_piece_depuis END, now()),
         externe = false
   WHERE id = p_incident_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lever_attente_piece(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents SET attente_piece = false WHERE id = p_incident_id AND attente_piece;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mettre_en_attente_piece(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lever_attente_piece(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mettre_en_attente_piece(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lever_attente_piece(uuid) TO authenticated;

-- Rangements exclusifs : confier à un extérieur retire « pièce en attente »
CREATE OR REPLACE FUNCTION public.confier_intervenant_exterieur(
  p_incident_id uuid,
  p_fournisseur_id uuid DEFAULT NULL,
  p_nom text DEFAULT NULL,
  p_date_prevue date DEFAULT NULL,
  p_commentaire text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
  v_statut text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  IF p_fournisseur_id IS NULL AND NULLIF(trim(p_nom), '') IS NULL THEN
    RAISE EXCEPTION 'Indique l''intervenant (fournisseur ou nom)';
  END IF;
  SELECT statut::text INTO v_statut FROM incidents WHERE id = p_incident_id;
  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_statut IN ('resolu', 'ferme') THEN
    RAISE EXCEPTION 'Ce ticket est déjà résolu';
  END IF;

  UPDATE incidents
     SET externe = true,
         externe_fournisseur_id = p_fournisseur_id,
         externe_nom = NULLIF(trim(p_nom), ''),
         externe_date_prevue = p_date_prevue,
         externe_commentaire = NULLIF(trim(p_commentaire), ''),
         externe_depuis = COALESCE(CASE WHEN externe THEN externe_depuis END, now()),
         externe_par_id = current_utilisateur_id(),
         attente_piece = false,
         statut = CASE WHEN statut = 'en_pause' THEN 'ouvert'::statut_incident ELSE statut END,
         pause_motif = NULL,
         pause_depuis = NULL
   WHERE id = p_incident_id;
END;
$$;

-- Démarrer l'intervention : le ticket quitte « pièce en attente » et « extérieur »
CREATE OR REPLACE FUNCTION public.demarrer_intervention(p_incident_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
  v_role text := current_role_code()::text;
  v_incident record;
  v_intervention record;
BEGIN
  IF v_utilisateur_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé à démarrer une intervention' USING ERRCODE = '42501';
  END IF;

  SELECT id, statut, est_formation, assigne_a_id INTO v_incident
  FROM incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;
  IF v_incident.statut IN ('resolu', 'ferme') THEN
    RAISE EXCEPTION 'Ce ticket est déjà résolu';
  END IF;

  SELECT id, debut INTO v_intervention
  FROM interventions
  WHERE incident_id = p_incident_id AND fin IS NULL
  ORDER BY debut DESC
  LIMIT 1;

  IF v_intervention.id IS NULL THEN
    INSERT INTO interventions (incident_id, technicien_id, debut, est_formation)
    VALUES (p_incident_id, v_utilisateur_id, now(), v_incident.est_formation)
    RETURNING id, debut INTO v_intervention;
  END IF;

  UPDATE incidents
     SET statut = 'en_cours'::statut_incident,
         assigne_a_id = COALESCE(assigne_a_id, v_utilisateur_id),
         pause_motif = NULL,
         pause_depuis = NULL,
         attente_piece = false,
         externe = false
   WHERE id = p_incident_id
     AND (statut <> 'en_cours' OR attente_piece OR externe);

  RETURN jsonb_build_object('intervention_id', v_intervention.id, 'debut', v_intervention.debut);
END;
$$;

-- Commande livrée : les tickets qui attendaient cette commande repassent « à faire »
CREATE OR REPLACE FUNCTION public.fn_commande_livree_leve_attente_piece()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.statut = 'livree' AND OLD.statut IS DISTINCT FROM 'livree' THEN
    UPDATE incidents SET attente_piece = false
     WHERE attente_piece AND attente_piece_commande_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_commande_livree_leve_attente_piece() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_commande_livree_leve_attente_piece
  AFTER UPDATE OF statut ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.fn_commande_livree_leve_attente_piece();
