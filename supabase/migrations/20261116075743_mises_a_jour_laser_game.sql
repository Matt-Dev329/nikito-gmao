-- Mises à jour périodiques d'une activité (ex. Laser Game, 3 fois par an) :
-- un planning par parc + un registre de toutes les mises à jour faites.
-- Rappel automatique (notification + mail) au chef d'équipe, aux directeurs
-- du parc et aux managers principaux : 30 jours avant l'échéance, 7 jours
-- avant, le jour J, puis chaque semaine tant que ce n'est pas fait.
CREATE TABLE public.mises_a_jour_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES public.parcs(id),
  activite text NOT NULL,
  libelle text NOT NULL,
  periode_mois integer NOT NULL DEFAULT 4 CHECK (periode_mois BETWEEN 1 AND 24),
  prochaine_echeance date NOT NULL,
  derniere_execution date,
  dernier_rappel date,
  rappel_mail_le date,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mises_a_jour_plans_parc_idx ON public.mises_a_jour_plans(parc_id);
CREATE TRIGGER trg_um_mises_a_jour_plans BEFORE UPDATE ON public.mises_a_jour_plans
  FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

CREATE TABLE public.mises_a_jour_registre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.mises_a_jour_plans(id),
  parc_id uuid NOT NULL REFERENCES public.parcs(id),
  fait_le date NOT NULL,
  version text,
  notes text,
  realise_par_id uuid REFERENCES public.utilisateurs(id),
  realise_par_nom text,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mises_a_jour_registre_plan_idx ON public.mises_a_jour_registre(plan_id);
CREATE INDEX mises_a_jour_registre_parc_idx ON public.mises_a_jour_registre(parc_id);
CREATE INDEX mises_a_jour_registre_realise_par_idx ON public.mises_a_jour_registre(realise_par_id);

ALTER TABLE public.mises_a_jour_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mises_a_jour_registre ENABLE ROW LEVEL SECURITY;

-- Lecture : pilotage du parc (direction, chef d'équipe, admin IT, directeurs, managers principaux)
CREATE POLICY mises_a_jour_plans_lecture ON public.mises_a_jour_plans
  FOR SELECT TO authenticated USING (acces_pilotage_parc(parc_id));
CREATE POLICY mises_a_jour_registre_lecture ON public.mises_a_jour_registre
  FOR SELECT TO authenticated USING (acces_pilotage_parc(parc_id));
-- Plannings : créés / modifiés par le chef d'équipe et la direction
CREATE POLICY mises_a_jour_plans_gestion ON public.mises_a_jour_plans
  FOR ALL TO authenticated
  USING ((SELECT current_role_code()) = ANY (ARRAY['chef_maintenance'::role_utilisateur, 'direction'::role_utilisateur]))
  WITH CHECK ((SELECT current_role_code()) = ANY (ARRAY['chef_maintenance'::role_utilisateur, 'direction'::role_utilisateur]));

-- Échéance suivante (fin de mois) : on avance d'une période si la mise à jour
-- est faite dans le mois qui précède l'échéance ou après.
CREATE OR REPLACE FUNCTION public.echeance_suivante_mise_a_jour(p_echeance date, p_periode integer, p_fait_le date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v date := p_echeance;
BEGIN
  IF p_fait_le >= v - interval '1 month' THEN
    v := (date_trunc('month', v) + make_interval(months => p_periode + 1) - interval '1 day')::date;
  END IF;
  WHILE v <= p_fait_le LOOP
    v := (date_trunc('month', v) + make_interval(months => p_periode + 1) - interval '1 day')::date;
  END LOOP;
  RETURN v;
END;
$function$;

-- Enregistrer une mise à jour faite (registre + échéance suivante)
CREATE OR REPLACE FUNCTION public.enregistrer_mise_a_jour(p_plan_id uuid, p_fait_le date, p_version text, p_notes text)
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

  INSERT INTO mises_a_jour_registre (plan_id, parc_id, fait_le, version, notes, realise_par_id, realise_par_nom)
  VALUES (p_plan_id, v_plan.parc_id, p_fait_le, nullif(trim(coalesce(p_version, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
          v_moi, (SELECT prenom || ' ' || nom FROM utilisateurs WHERE id = v_moi))
  RETURNING id INTO v_id;

  UPDATE mises_a_jour_plans
     SET derniere_execution = greatest(coalesce(derniere_execution, p_fait_le), p_fait_le),
         prochaine_echeance = echeance_suivante_mise_a_jour(prochaine_echeance, periode_mois, p_fait_le)
   WHERE id = p_plan_id;
  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enregistrer_mise_a_jour(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_mise_a_jour(uuid, date, text, text) TO authenticated;

-- Personnes à prévenir pour un parc : chef d'équipe, directeurs du parc, managers principaux du parc
CREATE OR REPLACE FUNCTION public.destinataires_mise_a_jour(p_parc uuid)
RETURNS TABLE (utilisateur_id uuid, email text, prenom text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT DISTINCT u.id, u.email, u.prenom
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE u.actif
    AND (r.code = 'chef_maintenance'
         OR EXISTS (SELECT 1 FROM parcs_utilisateurs pu
                    WHERE pu.utilisateur_id = u.id AND pu.parc_id = p_parc
                      AND (r.code = 'directeur_parc' OR (r.code = 'manager_parc' AND pu.est_manager))));
$function$;
REVOKE EXECUTE ON FUNCTION public.destinataires_mise_a_jour(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.destinataires_mise_a_jour(uuid) TO service_role;

-- Rappels du jour (pg_cron) : notification immédiate, puis mail via l'edge function
CREATE OR REPLACE FUNCTION public.rappels_mises_a_jour()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_plan record;
  v_dest record;
  v_nb integer := 0;
  v_titre text;
  v_corps text;
BEGIN
  FOR v_plan IN
    SELECT m.*, p.nom AS parc_nom
    FROM mises_a_jour_plans m JOIN parcs p ON p.id = m.parc_id
    WHERE m.actif
      AND v_jour >= m.prochaine_echeance - 30
      AND (m.dernier_rappel IS NULL OR m.dernier_rappel < v_jour)
      AND (m.dernier_rappel IS NULL
           OR m.dernier_rappel < m.prochaine_echeance - 30
           OR v_jour IN (m.prochaine_echeance - 7, m.prochaine_echeance)
           OR (v_jour > m.prochaine_echeance AND v_jour - m.dernier_rappel >= 7))
    FOR UPDATE OF m
  LOOP
    UPDATE mises_a_jour_plans SET dernier_rappel = v_jour WHERE id = v_plan.id;
    v_nb := v_nb + 1;
    v_titre := CASE WHEN v_jour > v_plan.prochaine_echeance THEN 'En retard · ' ELSE 'Rappel · ' END
               || v_plan.libelle || ' · ' || v_plan.parc_nom;
    v_corps := 'À faire avant le ' || to_char(v_plan.prochaine_echeance, 'DD/MM/YYYY')
               || '. Une fois faite, enregistre-la dans le registre.';
    FOR v_dest IN SELECT * FROM destinataires_mise_a_jour(v_plan.parc_id) LOOP
      BEGIN
        PERFORM notifier_push(v_dest.utilisateur_id, v_titre, v_corps, '/gmao/mises-a-jour');
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  IF v_nb > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://xhpykmhbahiikqbzwfkc.supabase.co/functions/v1/rappel-mises-a-jour',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN v_nb;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rappels_mises_a_jour() FROM PUBLIC, anon, authenticated;

-- Plannings Laser Game : Alfortville, Sainte-Geneviève, Franconville —
-- 3 fois par an (tous les 4 mois), première échéance fin janvier 2027
INSERT INTO public.mises_a_jour_plans (parc_id, activite, libelle, periode_mois, prochaine_echeance)
SELECT id, 'Laser Game', 'Mise à jour Laser Game', 4, DATE '2027-01-31'
FROM public.parcs WHERE code IN ('ALF', 'SGB', 'FRA');

SELECT cron.schedule('gmao_rappels_mises_a_jour', '25 6 * * *', 'SELECT public.rappels_mises_a_jour()');