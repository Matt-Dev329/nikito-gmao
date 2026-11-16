-- MAJ Laser Game : on choisit soi-même les dates.
-- 1) En enregistrant une mise à jour, on peut indiquer la prochaine échéance
--    (proposée par défaut : 4 mois après la date de la mise à jour).
-- 2) L'échéance d'un parc peut être modifiée à la main.
CREATE OR REPLACE FUNCTION public.enregistrer_mise_a_jour(p_plan_id uuid, p_fait_le date, p_version text, p_notes text, p_prochaine date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
  v_plan record;
  v_id uuid;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  SELECT * INTO v_plan FROM mises_a_jour_plans WHERE id = p_plan_id AND actif FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planning introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_plan.parc_id) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_fait_le IS NULL OR p_fait_le > (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'Date de mise à jour invalide';
  END IF;
  IF p_prochaine IS NOT NULL AND p_prochaine <= p_fait_le THEN
    RAISE EXCEPTION 'La prochaine échéance doit être après la date de la mise à jour';
  END IF;

  INSERT INTO mises_a_jour_registre (plan_id, parc_id, fait_le, version, notes, realise_par_id, realise_par_nom)
  VALUES (p_plan_id, v_plan.parc_id, p_fait_le, nullif(trim(coalesce(p_version, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
          v_moi, (SELECT prenom || ' ' || nom FROM utilisateurs WHERE id = v_moi))
  RETURNING id INTO v_id;

  UPDATE mises_a_jour_plans
     SET derniere_execution = greatest(coalesce(derniere_execution, p_fait_le), p_fait_le),
         prochaine_echeance = coalesce(p_prochaine, (p_fait_le + make_interval(months => periode_mois))::date),
         dernier_rappel = NULL
   WHERE id = p_plan_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enregistrer_mise_a_jour(uuid, date, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_mise_a_jour(uuid, date, text, text, date) TO authenticated;

-- Ancienne signature (4 paramètres) : même comportement, échéance par défaut
CREATE OR REPLACE FUNCTION public.enregistrer_mise_a_jour(p_plan_id uuid, p_fait_le date, p_version text, p_notes text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT enregistrer_mise_a_jour(p_plan_id, p_fait_le, p_version, p_notes, NULL::date);
$function$;

CREATE OR REPLACE FUNCTION public.modifier_echeance_mise_a_jour(p_plan_id uuid, p_echeance date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parc uuid;
BEGIN
  IF current_utilisateur_id() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  SELECT parc_id INTO v_parc FROM mises_a_jour_plans WHERE id = p_plan_id AND actif FOR UPDATE;
  IF v_parc IS NULL THEN
    RAISE EXCEPTION 'Planning introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_parc) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_echeance IS NULL OR p_echeance < date '2020-01-01' OR p_echeance > (now() AT TIME ZONE 'Europe/Paris')::date + interval '3 years' THEN
    RAISE EXCEPTION 'Date d''échéance invalide';
  END IF;
  UPDATE mises_a_jour_plans SET prochaine_echeance = p_echeance, dernier_rappel = NULL WHERE id = p_plan_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.modifier_echeance_mise_a_jour(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_echeance_mise_a_jour(uuid, date) TO authenticated;