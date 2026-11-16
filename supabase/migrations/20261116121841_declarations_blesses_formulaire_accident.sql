-- Déclarations de blessés : champs du « Formulaire d'accident » Nikito
-- (coordonnées du blessé, niveau 1/2/3, parc & activité, emplacement,
-- secouristes, staff référent, manager au courant). La table est vide.
ALTER TABLE public.declarations_blesses
  ADD COLUMN peut_se_deplacer boolean,
  ADD COLUMN victime_date_naissance date,
  ADD COLUMN victime_adresse text,
  ADD COLUMN victime_cp_ville text,
  ADD COLUMN niveau smallint CHECK (niveau BETWEEN 1 AND 3),
  ADD COLUMN blessure text,
  ADD COLUMN activite text,
  ADD COLUMN emplacement text,
  ADD COLUMN secouristes boolean,
  ADD COLUMN secouristes_heure time,
  ADD COLUMN staff_referent text,
  ADD COLUMN manager_informe boolean,
  ADD COLUMN manager_prenom text,
  ALTER COLUMN victime_type DROP NOT NULL,
  ALTER COLUMN circonstances DROP NOT NULL,
  ALTER COLUMN gravite DROP NOT NULL;

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
  v_naissance date;
  v_niveau smallint;
  v_secouristes boolean := (p_donnees->>'secouristes')::boolean;
  v_manager boolean := (p_donnees->>'manager_informe')::boolean;
  v_parc_nom text;
  v_dest record;
  v_titre text;
  v_champ text;
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

  -- Champs obligatoires du formulaire
  FOREACH v_champ IN ARRAY ARRAY['victime_nom', 'victime_prenom', 'victime_adresse', 'victime_cp_ville',
                                  'contact_telephone', 'blessure', 'activite', 'emplacement', 'staff_referent'] LOOP
    IF length(trim(coalesce(p_donnees->>v_champ, ''))) = 0 THEN
      RAISE EXCEPTION 'Champ obligatoire manquant : %', v_champ;
    END IF;
  END LOOP;
  IF (p_donnees->>'peut_se_deplacer') IS NULL OR v_secouristes IS NULL OR v_manager IS NULL THEN
    RAISE EXCEPTION 'Réponds à toutes les questions oui / non';
  END IF;
  IF v_secouristes AND nullif(p_donnees->>'secouristes_heure', '') IS NULL THEN
    RAISE EXCEPTION 'Indique l''heure de prise en charge par les secouristes';
  END IF;
  IF v_manager AND length(trim(coalesce(p_donnees->>'manager_prenom', ''))) = 0 THEN
    RAISE EXCEPTION 'Indique le prénom du manager';
  END IF;
  BEGIN
    v_survenu := (p_donnees->>'survenu_le')::timestamptz;
    v_naissance := (p_donnees->>'victime_date_naissance')::date;
    v_niveau := (p_donnees->>'niveau')::smallint;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Date, heure ou niveau de blessure invalide';
  END;
  IF v_survenu IS NULL OR v_survenu > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'Date et heure de l''accident invalides';
  END IF;
  IF v_naissance IS NULL OR v_naissance > current_date OR v_naissance < date '1900-01-01' THEN
    RAISE EXCEPTION 'Date de naissance invalide';
  END IF;
  IF v_niveau IS NULL OR v_niveau NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Choisis le niveau de blessure (1, 2 ou 3)';
  END IF;

  v_numero := 'BL-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-'
              || lpad(nextval('declarations_blesses_numero_seq')::text, 4, '0');

  INSERT INTO declarations_blesses (
    numero, parc_id, survenu_le, peut_se_deplacer, victime_nom, victime_prenom, victime_date_naissance,
    est_mineur, victime_adresse, victime_cp_ville, contact_telephone, niveau, blessure, activite,
    emplacement, secouristes, secouristes_heure, staff_referent, circonstances, manager_informe,
    manager_prenom, declare_par_id, declare_par_nom, declare_par_role)
  VALUES (
    v_numero, p_parc_id, v_survenu,
    (p_donnees->>'peut_se_deplacer')::boolean,
    left(trim(p_donnees->>'victime_nom'), 100),
    left(trim(p_donnees->>'victime_prenom'), 100),
    v_naissance,
    v_naissance > ((v_survenu AT TIME ZONE 'Europe/Paris')::date - interval '18 years'),
    left(trim(p_donnees->>'victime_adresse'), 300),
    left(trim(p_donnees->>'victime_cp_ville'), 150),
    left(trim(p_donnees->>'contact_telephone'), 40),
    v_niveau,
    left(trim(p_donnees->>'blessure'), 500),
    left(trim(p_donnees->>'activite'), 80),
    left(trim(p_donnees->>'emplacement'), 200),
    v_secouristes,
    CASE WHEN v_secouristes THEN (p_donnees->>'secouristes_heure')::time END,
    left(trim(p_donnees->>'staff_referent'), 150),
    nullif(left(trim(coalesce(p_donnees->>'circonstances', '')), 4000), ''),
    v_manager,
    nullif(left(trim(coalesce(p_donnees->>'manager_prenom', '')), 100), ''),
    v_auteur.id, trim(coalesce(v_auteur.prenom, '') || ' ' || coalesce(v_auteur.nom, '')), v_auteur.role);

  -- Prévenir le chef d'équipe, les directeurs et managers principaux du parc (sans données de santé détaillées)
  v_titre := CASE WHEN v_niveau = 3 THEN '🚨 Blessé niveau 3 · ' ELSE '🩹 Blessé niveau ' || v_niveau || ' · ' END || v_parc_nom;
  FOR v_dest IN SELECT * FROM destinataires_mise_a_jour(p_parc_id) LOOP
    BEGIN
      PERFORM notifier_push(v_dest.utilisateur_id, v_titre,
        v_numero || ' · ' || left(trim(p_donnees->>'activite'), 40) || ' · ' || left(trim(p_donnees->>'emplacement'), 60),
        '/gmao/blesses');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_numero;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.declarer_blesse(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.declarer_blesse(uuid, jsonb, uuid) TO anon, authenticated;