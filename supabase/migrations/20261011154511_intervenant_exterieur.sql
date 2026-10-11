/*
  # Tickets confiés à un intervenant extérieur

  Certains problèmes ne sont pas traités par l'équipe (prestataire, fabricant,
  société spécialisée). Un ticket peut être « confié à un intervenant
  extérieur » : il sort de la file « À faire » de l'équipe, apparaît dans
  l'onglet « Extérieur » et reste suivi jusqu'à sa clôture.

  1. incidents : externe, externe_fournisseur_id (fournisseur connu) ou
     externe_nom (saisie libre), externe_date_prevue, externe_commentaire,
     externe_depuis, externe_par_id.
  2. RPC confier_intervenant_exterieur / reprendre_ticket_en_interne /
     cloturer_ticket_exterieur (compte-rendu de l'intervenant, ticket résolu).
*/

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS externe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS externe_fournisseur_id uuid REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS externe_nom text,
  ADD COLUMN IF NOT EXISTS externe_date_prevue date,
  ADD COLUMN IF NOT EXISTS externe_commentaire text,
  ADD COLUMN IF NOT EXISTS externe_depuis timestamptz,
  ADD COLUMN IF NOT EXISTS externe_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_externe_fournisseur ON public.incidents(externe_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_incidents_externe_par ON public.incidents(externe_par_id);

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
         statut = CASE WHEN statut = 'en_pause' THEN 'ouvert'::statut_incident ELSE statut END,
         pause_motif = NULL,
         pause_depuis = NULL
   WHERE id = p_incident_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reprendre_ticket_en_interne(p_incident_id uuid)
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
  UPDATE incidents SET externe = false WHERE id = p_incident_id AND externe;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_ticket_exterieur(p_incident_id uuid, p_compte_rendu text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
  v_utilisateur_id uuid := current_utilisateur_id();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(p_compte_rendu), '') IS NULL THEN
    RAISE EXCEPTION 'Le compte-rendu de l''intervenant est obligatoire';
  END IF;

  UPDATE incidents
     SET statut = 'resolu'::statut_incident,
         resolu_le = now(),
         resolu_par_id = v_utilisateur_id,
         meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
           'externe_compte_rendu', trim(p_compte_rendu),
           'externe_cloture_le', now(),
           'externe_cloture_par_id', v_utilisateur_id
         )
   WHERE id = p_incident_id AND externe AND statut NOT IN ('resolu', 'ferme');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable, déjà résolu ou non confié à un intervenant extérieur';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confier_intervenant_exterieur(uuid, uuid, text, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reprendre_ticket_en_interne(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cloturer_ticket_exterieur(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confier_intervenant_exterieur(uuid, uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprendre_ticket_en_interne(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_ticket_exterieur(uuid, text) TO authenticated;
