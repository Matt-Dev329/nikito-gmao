/*
  # Plans et manuels : fichiers découpés en parties

  La limite d'envoi globale du projet (50 Mo) s'applique à chaque fichier.
  Les documents plus lourds sont découpés côté application en parties de
  40 Mo (`<chemin>.part001`, `.part002`…) puis recollés à l'ouverture.
  `parties` = nombre de parties (NULL = fichier unique stocké à `chemin`).
*/

ALTER TABLE public.documents_techniques
  ADD COLUMN IF NOT EXISTS parties integer CHECK (parties IS NULL OR parties >= 1);
