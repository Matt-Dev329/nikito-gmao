-- Interventions d'urgence : registre personnel de Ryad (et de lui seul :
-- acces_tableau_de_bord). Heure d'appel, début et fin d'intervention,
-- détails, pièces, photos / vidéos (bucket alba-perso, dossier personnel).
CREATE TABLE public.interventions_urgence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL DEFAULT current_utilisateur_id() REFERENCES public.utilisateurs(id),
  parc_id uuid REFERENCES public.parcs(id),
  activite text,
  equipement text,
  appelant text,
  heure_appel timestamptz,
  debut_intervention timestamptz,
  fin_intervention timestamptz,
  probleme text,
  details text,
  pieces text,
  medias text[] NOT NULL DEFAULT '{}',
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interventions_urgence_fin_apres_debut CHECK (fin_intervention IS NULL OR debut_intervention IS NULL OR fin_intervention >= debut_intervention)
);
CREATE INDEX interventions_urgence_utilisateur_idx ON public.interventions_urgence(utilisateur_id);
CREATE INDEX interventions_urgence_parc_idx ON public.interventions_urgence(parc_id);

CREATE TRIGGER trg_um_interventions_urgence BEFORE UPDATE ON public.interventions_urgence
  FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

ALTER TABLE public.interventions_urgence ENABLE ROW LEVEL SECURITY;
CREATE POLICY interventions_urgence_proprietaire ON public.interventions_urgence FOR ALL TO authenticated
  USING (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()))
  WITH CHECK (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()));