-- « Staff Arcade » (rôle consultation_arcade) : voit les tickets arcade de ses
-- parcs (problème + photos) et ne peut RIEN faire d'autre.
INSERT INTO public.roles (code, nom, ordre, permissions)
VALUES ('consultation_arcade', 'Staff Arcade (consultation)', 7, '{}'::jsonb);

-- Seule porte d'accès : les tickets arcade de ses parcs (en cours + résolus
-- depuis 30 jours). Ouverte aussi à la direction / chef d'équipe / admin IT
-- (aperçu « voir comme »).
CREATE OR REPLACE FUNCTION public.tickets_arcade_consultation()
RETURNS TABLE(id uuid, numero_bt text, titre text, description text, symptome text, statut text,
              declare_le timestamptz, resolu_le timestamptz, parc_code text, parc_nom text,
              equipement_code text, equipement_libelle text, numero_reader text, priorite text,
              photos_urls text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := current_role_code()::text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('consultation_arcade', 'direction', 'chef_maintenance', 'admin_it') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.numero_bt::text, i.titre::text, i.description::text, i.symptome::text, i.statut::text,
         i.declare_le, i.resolu_le, p.code::text, p.nom::text,
         e.code::text, e.libelle::text, e.numero_reader::text, np.nom::text,
         coalesce(i.photos_urls::text[], '{}'::text[])
  FROM incidents i
  JOIN equipements e ON e.id = i.equipement_id
  JOIN categories_equipement c ON c.id = e.categorie_id
  JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  WHERE lower(trim(c.activite)) = 'arcade'
    AND NOT coalesce(i.est_formation, false)
    AND NOT coalesce(i.est_brouillon, false)
    AND i.supprime_le IS NULL
    AND (v_role <> 'consultation_arcade' OR e.parc_id = ANY (current_parc_ids()))
    AND (i.statut::text NOT IN ('resolu', 'annule', 'ferme') OR i.resolu_le > now() - interval '30 days')
  ORDER BY (i.statut::text IN ('resolu', 'annule', 'ferme')), i.declare_le DESC;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.tickets_arcade_consultation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickets_arcade_consultation() TO authenticated;

-- Garde de chaque requête (pgrst.db_pre_request) : en plus de l'ancienne
-- adresse, un compte « Staff Arcade » ne peut faire aucune écriture ni action
-- (tout ce qui n'est pas une lecture), sauf la connexion (2FA, appareil
-- reconnu, invitation), les notifications et sa liste de tickets.
CREATE OR REPLACE FUNCTION public.bloquer_ancienne_adresse()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entetes json;
  v_methode text;
  v_chemin text;
  v_role text;
BEGIN
  BEGIN
    v_entetes := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_entetes := NULL;
  END;
  IF v_entetes IS NOT NULL
     AND (coalesce(v_entetes->>'origin', '') ILIKE '%bolt.host%'
          OR coalesce(v_entetes->>'referer', '') ILIKE '%bolt.host%') THEN
    RAISE EXCEPTION 'ALBA a déménagé : utilise https://nikito.tech'
      USING ERRCODE = '42501', HINT = 'https://nikito.tech';
  END IF;

  -- Staff Arcade : consultation seule
  v_methode := upper(coalesce(nullif(current_setting('request.method', true), ''), 'GET'));
  IF v_methode IN ('GET', 'HEAD', 'OPTIONS') THEN
    RETURN;
  END IF;
  BEGIN
    v_role := current_role_code()::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF v_role IS DISTINCT FROM 'consultation_arcade' THEN
    RETURN;
  END IF;
  v_chemin := coalesce(current_setting('request.path', true), '');
  IF v_chemin ~ '(^|/)(rpc/)?(tickets_arcade_consultation|verifier_device_reconnu|rafraichir_device|verifier_code_2fa|enregistrer_device|accepter_invitation|supprimer_devices_utilisateur_courant|enregistrer_abonnement_push|desactiver_abonnement_push|codes_2fa)/?$' THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Compte Staff Arcade : consultation seule' USING ERRCODE = '42501';
END;
$function$;

-- Fichiers (photos, documents) : aucun ajout / modification / suppression
CREATE POLICY consultation_arcade_pas_d_ajout ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT current_role_code())::text IS DISTINCT FROM 'consultation_arcade');
CREATE POLICY consultation_arcade_pas_de_modification ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING ((SELECT current_role_code())::text IS DISTINCT FROM 'consultation_arcade')
  WITH CHECK ((SELECT current_role_code())::text IS DISTINCT FROM 'consultation_arcade');
CREATE POLICY consultation_arcade_pas_de_suppression ON storage.objects AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING ((SELECT current_role_code())::text IS DISTINCT FROM 'consultation_arcade');