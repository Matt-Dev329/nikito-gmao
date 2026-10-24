-- Espace personnel de Ryad (et de lui seul, même règle que le tableau de
-- bord : acces_tableau_de_bord) :
-- - Bloc-notes : notes libres avec photos annotées (cotes, textes) ;
-- - Projets : idées et projets, avec l'avis d'ALBA (intérêt, faisabilité,
--   étapes, risques) et des propositions de projets tirées de la GMAO.
-- Chaque ligne n'est visible que par son auteur, et seulement s'il a l'accès.

CREATE TABLE public.notes_perso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL DEFAULT current_utilisateur_id() REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  titre text NOT NULL DEFAULT '',
  contenu text,
  -- [{ chemin, legende, annotations: [{ type: 'cote' | 'texte', x1, y1, x2?, y2?, texte, couleur }] }]
  -- coordonnées en fraction de la largeur / hauteur de la photo (0 à 1)
  photos jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(photos) = 'array'),
  epinglee boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_perso_utilisateur_idx ON public.notes_perso (utilisateur_id, modifie_le DESC);

CREATE TABLE public.projets_perso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL DEFAULT current_utilisateur_id() REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  titre text NOT NULL CHECK (length(trim(titre)) > 0),
  description text,
  notes text,
  statut text NOT NULL DEFAULT 'idee' CHECK (statut IN ('idee', 'en_cours', 'termine', 'abandonne')),
  origine text NOT NULL DEFAULT 'moi' CHECK (origine IN ('moi', 'alba')),
  avis jsonb,
  avis_statut text CHECK (avis_statut IN ('en_cours', 'terminee', 'echec')),
  avis_erreur text,
  avis_le timestamptz,
  modele text,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projets_perso_utilisateur_idx ON public.projets_perso (utilisateur_id, modifie_le DESC);

CREATE OR REPLACE FUNCTION public.fn_espace_perso_maj()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.modifie_le := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notes_perso_maj BEFORE UPDATE ON public.notes_perso
  FOR EACH ROW EXECUTE FUNCTION fn_espace_perso_maj();
CREATE TRIGGER projets_perso_maj BEFORE UPDATE ON public.projets_perso
  FOR EACH ROW EXECUTE FUNCTION fn_espace_perso_maj();

ALTER TABLE public.notes_perso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets_perso ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_perso_proprietaire ON public.notes_perso
  FOR ALL TO authenticated
  USING (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()))
  WITH CHECK (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()));

CREATE POLICY projets_perso_proprietaire ON public.projets_perso
  FOR ALL TO authenticated
  USING (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()))
  WITH CHECK (utilisateur_id = (SELECT current_utilisateur_id()) AND (SELECT acces_tableau_de_bord()));

REVOKE ALL ON public.notes_perso, public.projets_perso FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.notes_perso, public.projets_perso TO authenticated;

-- Photos du bloc-notes : bucket privé, dossier « <id utilisateur>/… »
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('alba-perso', 'alba-perso', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY alba_perso_lecture ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'alba-perso'
         AND split_part(name, '/', 1) = (SELECT current_utilisateur_id())::text
         AND (SELECT acces_tableau_de_bord()));
CREATE POLICY alba_perso_ajout ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'alba-perso'
              AND split_part(name, '/', 1) = (SELECT current_utilisateur_id())::text
              AND (SELECT acces_tableau_de_bord()));
