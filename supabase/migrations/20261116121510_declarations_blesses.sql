-- Déclarations de blessés (clients, salariés…) : formulaire ouvert à tous
-- (staff connecté par code compris) sauf les techniciens ; registre consulté
-- par la direction, le chef d'équipe, l'admin IT (tous les parcs), les
-- directeurs et managers (leurs parcs) — ni le staff ni les techniciens.
-- Données de santé : aucune écriture directe, tout passe par declarer_blesse.
CREATE SEQUENCE public.declarations_blesses_numero_seq;

CREATE TABLE public.declarations_blesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  parc_id uuid NOT NULL REFERENCES public.parcs(id),
  survenu_le timestamptz NOT NULL,
  lieu text,
  victime_type text NOT NULL CHECK (victime_type IN ('client', 'salarie', 'prestataire', 'autre')),
  victime_nom text,
  victime_prenom text,
  victime_age integer CHECK (victime_age IS NULL OR victime_age BETWEEN 0 AND 120),
  est_mineur boolean NOT NULL DEFAULT false,
  responsable_nom text,
  contact_telephone text,
  circonstances text NOT NULL,
  natures text[] NOT NULL DEFAULT '{}',
  parties_corps text[] NOT NULL DEFAULT '{}',
  gravite text NOT NULL CHECK (gravite IN ('legere', 'moyenne', 'grave')),
  soins text,
  secours text NOT NULL DEFAULT 'aucun' CHECK (secours IN ('aucun', 'pompiers', 'samu', 'medecin', 'autre')),
  evacuation_hopital boolean NOT NULL DEFAULT false,
  activite_arretee boolean NOT NULL DEFAULT false,
  temoins text,
  declare_par_id uuid REFERENCES public.utilisateurs(id),
  declare_par_nom text,
  declare_par_role text,
  declare_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX declarations_blesses_parc_idx ON public.declarations_blesses(parc_id, survenu_le DESC);
CREATE INDEX declarations_blesses_declare_par_idx ON public.declarations_blesses(declare_par_id);

ALTER TABLE public.declarations_blesses ENABLE ROW LEVEL SECURITY;

-- Registre : direction, chef d'équipe, admin IT (tout) ; directeurs et managers (leurs parcs)
CREATE OR REPLACE FUNCTION public.acces_registre_blesses(p_parc uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT CASE (SELECT current_role_code())
    WHEN 'direction' THEN true
    WHEN 'chef_maintenance' THEN true
    WHEN 'admin_it' THEN true
    WHEN 'directeur_parc' THEN p_parc IS NULL OR p_parc = ANY (current_parc_ids())
    WHEN 'manager_parc' THEN p_parc IS NULL OR p_parc = ANY (current_parc_ids())
    ELSE false
  END;
$function$;
REVOKE EXECUTE ON FUNCTION public.acces_registre_blesses(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_registre_blesses(uuid) TO authenticated;

CREATE POLICY declarations_blesses_lecture ON public.declarations_blesses
  FOR SELECT TO authenticated USING (acces_registre_blesses(parc_id));

-- Déclaration : compte connecté (sauf technicien) ou staff connecté par code (p_staff_id)
CREATE OR REPLACE FUNCTION public.declarer_blesse(p_parc_id uuid, p_donnees jsonb, p_staff_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_auteur record;
  v_numero text;
  v_survenu timestamptz;
  v_gravite text := p_donnees->>'gravite';
  v_parc_nom text;
  v_dest record;
  v_titre text;
  v_corps text;
BEGIN
  IF v_moi IS NOT NULL THEN
    SELECT u.id, u.prenom, u.nom, r.code::text AS role INTO v_auteur
    FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE u.id = v_moi AND u.actif;
    IF v_auteur.id IS NULL OR v_auteur.role = 'technicien' THEN
      RAISE EXCEPTION 'Déclaration de blessé non autorisée pour ce compte' USING ERRCODE = '42501';
    END IF;
    IF v_auteur.role NOT IN ('direction', 'chef_maintenance', 'admin_it') AND NOT (p_parc_id = ANY (current_parc_ids())) THEN
      RAISE EXCEPTION 'Parc non autorisé' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT u.id, u.prenom, u.nom, r.code::text AS role INTO v_auteur
    FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE u.id = p_staff_id AND u.actif;
    IF v_auteur.id IS NULL OR v_auteur.role = 'technicien' THEN
      RAISE EXCEPTION 'Déclaration de blessé non autorisée pour ce compte' USING ERRCODE = '42501';
    END IF;
    IF NOT (p_parc_id = ANY (parcs_de_utilisateur(p_staff_id))) THEN
      RAISE EXCEPTION 'Parc non autorisé' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT nom INTO v_parc_nom FROM parcs WHERE id = p_parc_id AND actif;
  IF v_parc_nom IS NULL THEN
    RAISE EXCEPTION 'Parc introuvable';
  END IF;
  BEGIN
    v_survenu := (p_donnees->>'survenu_le')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Date et heure de l''accident invalides';
  END;
  IF v_survenu IS NULL OR v_survenu > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'Date et heure de l''accident invalides';
  END IF;
  IF length(trim(coalesce(p_donnees->>'circonstances', ''))) < 5 THEN
    RAISE EXCEPTION 'Décris ce qui s''est passé';
  END IF;

  v_numero := 'BL-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-'
              || lpad(nextval('declarations_blesses_numero_seq')::text, 4, '0');

  INSERT INTO declarations_blesses (
    numero, parc_id, survenu_le, lieu, victime_type, victime_nom, victime_prenom, victime_age,
    est_mineur, responsable_nom, contact_telephone, circonstances, natures, parties_corps, gravite,
    soins, secours, evacuation_hopital, activite_arretee, temoins,
    declare_par_id, declare_par_nom, declare_par_role)
  VALUES (
    v_numero, p_parc_id, v_survenu,
    nullif(left(trim(coalesce(p_donnees->>'lieu', '')), 300), ''),
    p_donnees->>'victime_type',
    nullif(left(trim(coalesce(p_donnees->>'victime_nom', '')), 100), ''),
    nullif(left(trim(coalesce(p_donnees->>'victime_prenom', '')), 100), ''),
    nullif(p_donnees->>'victime_age', '')::integer,
    coalesce((p_donnees->>'est_mineur')::boolean, false),
    nullif(left(trim(coalesce(p_donnees->>'responsable_nom', '')), 200), ''),
    nullif(left(trim(coalesce(p_donnees->>'contact_telephone', '')), 40), ''),
    left(trim(p_donnees->>'circonstances'), 4000),
    coalesce(ARRAY(SELECT left(jsonb_array_elements_text(coalesce(p_donnees->'natures', '[]'::jsonb)), 80)), '{}'),
    coalesce(ARRAY(SELECT left(jsonb_array_elements_text(coalesce(p_donnees->'parties_corps', '[]'::jsonb)), 80)), '{}'),
    v_gravite,
    nullif(left(trim(coalesce(p_donnees->>'soins', '')), 2000), ''),
    coalesce(nullif(p_donnees->>'secours', ''), 'aucun'),
    coalesce((p_donnees->>'evacuation_hopital')::boolean, false),
    coalesce((p_donnees->>'activite_arretee')::boolean, false),
    nullif(left(trim(coalesce(p_donnees->>'temoins', '')), 1000), ''),
    v_auteur.id, trim(coalesce(v_auteur.prenom, '') || ' ' || coalesce(v_auteur.nom, '')), v_auteur.role);

  -- Prévenir le chef d'équipe, les directeurs et managers principaux du parc
  v_titre := CASE v_gravite WHEN 'grave' THEN '🚨 Blessé grave · ' ELSE '🩹 Blessé · ' END || v_parc_nom;
  v_corps := v_numero || ' · ' || left(trim(p_donnees->>'circonstances'), 140);
  FOR v_dest IN SELECT * FROM destinataires_mise_a_jour(p_parc_id) LOOP
    BEGIN
      PERFORM notifier_push(v_dest.utilisateur_id, v_titre, v_corps, '/gmao/blesses');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_numero;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.declarer_blesse(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.declarer_blesse(uuid, jsonb, uuid) TO anon, authenticated;