-- Annonces envoyées par mail à tous les comptes (une seule fois par adresse)
CREATE TABLE public.annonces_envoyees (
  annonce text NOT NULL,
  email text NOT NULL,
  envoye_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (annonce, email)
);
ALTER TABLE public.annonces_envoyees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.annonces_envoyees FROM anon, authenticated;
