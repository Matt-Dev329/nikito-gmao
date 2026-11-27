-- Tâches récurrentes à valider (ex. « Envoi de pièce du laser game » chaque vendredi pour Ryad et Samy) :
-- une tâche est créée le jour prévu, notifiée sur le téléphone, et reste dans les notifications jusqu'à validation.
CREATE TABLE public.taches_recurrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL,
  jour_semaine smallint NOT NULL CHECK (jour_semaine BETWEEN 1 AND 7), -- 1 = lundi … 5 = vendredi
  destinataires uuid[] NOT NULL DEFAULT '{}',
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taches_recurrentes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.taches_a_valider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tache_id uuid NOT NULL REFERENCES public.taches_recurrentes(id),
  libelle text NOT NULL,
  echeance date NOT NULL,
  destinataires uuid[] NOT NULL,
  valide_le timestamptz,
  valide_par_id uuid REFERENCES public.utilisateurs(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tache_id, echeance)
);
CREATE INDEX taches_a_valider_valide_par_idx ON public.taches_a_valider (valide_par_id);
ALTER TABLE public.taches_a_valider ENABLE ROW LEVEL SECURITY;
CREATE POLICY taches_a_valider_lecture ON public.taches_a_valider FOR SELECT TO authenticated
  USING ((SELECT current_utilisateur_id()) = ANY (destinataires));

-- Validation : par l'un des destinataires (vaut pour tous)
CREATE OR REPLACE FUNCTION public.valider_tache(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE moi uuid := current_utilisateur_id();
BEGIN
  UPDATE taches_a_valider SET valide_le = now(), valide_par_id = moi
  WHERE id = p_id AND valide_le IS NULL AND moi = ANY (destinataires);
  IF NOT FOUND THEN RAISE EXCEPTION 'Tâche introuvable ou déjà validée' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.valider_tache(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valider_tache(uuid) TO authenticated;

-- Génération du jour (cron quotidien) + notification sur le téléphone
CREATE OR REPLACE FUNCTION public.generer_taches_a_valider()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE t record; u uuid; nb integer := 0; aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  FOR t IN
    INSERT INTO taches_a_valider (tache_id, libelle, echeance, destinataires)
    SELECT r.id, r.libelle, aujourdhui, r.destinataires FROM taches_recurrentes r
    WHERE r.actif AND r.jour_semaine = extract(isodow FROM aujourdhui)
    ON CONFLICT (tache_id, echeance) DO NOTHING
    RETURNING libelle, destinataires
  LOOP
    nb := nb + 1;
    FOREACH u IN ARRAY t.destinataires LOOP
      BEGIN
        PERFORM notifier_push(u, t.libelle, 'À faire aujourd''hui : touche la notification puis « Valider » une fois fait.', '/gmao/operations');
      EXCEPTION WHEN others THEN NULL; -- la tâche reste créée même si la notification échoue
      END;
    END LOOP;
  END LOOP;
  RETURN nb;
END $$;
REVOKE ALL ON FUNCTION public.generer_taches_a_valider() FROM PUBLIC, anon, authenticated;

INSERT INTO public.taches_recurrentes (libelle, jour_semaine, destinataires) VALUES
  ('Envoi de pièce du laser game', 5, ARRAY['4d77ab9a-f56d-4180-89f5-511705f0a05f', '317c6ac9-dc3f-41cb-85a8-7d8032a4de42']::uuid[]);

SELECT cron.schedule('gmao_taches_a_valider', '37 6 * * *', 'SELECT public.generer_taches_a_valider()');
