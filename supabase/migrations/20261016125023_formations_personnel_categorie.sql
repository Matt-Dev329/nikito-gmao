-- Catégorie de rangement des formations, attribuée automatiquement par l'IA
-- (classer-formations) et modifiable à la main.
ALTER TABLE public.formations_personnel ADD COLUMN IF NOT EXISTS categorie text;
CREATE INDEX IF NOT EXISTS formations_personnel_categorie_idx ON public.formations_personnel (categorie);