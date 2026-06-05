/*
  # Ajout de la colonne resolu_par_id sur incidents (correctif clôture)

  1. Problème
    - Le trigger `fn_notify_arcade_incident_resolu` (déclenché quand un incident
      passe en `resolu` sur un équipement de catégorie « arcade ») lit
      `NEW.resolu_par_id`, colonne qui n'existait pas dans `incidents`.
    - Résultat : `ERROR: record "new" has no field "resolu_par_id"` → toute la
      transaction de clôture échouait pour les équipements arcade.
    - Bug latent jamais déclenché auparavant car le bouton « Clôturer » n'était
      pas branché (aucun incident ne passait réellement en `resolu`).

  2. Correctif
    - Ajout de la colonne `resolu_par_id` (qui était déjà attendue par le trigger
      et le payload de notification : « qui a résolu l'incident »).
    - Colonne nullable, FK vers utilisateurs. La mutation de clôture la renseigne.
*/

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS resolu_par_id uuid REFERENCES public.utilisateurs(id);

COMMENT ON COLUMN public.incidents.resolu_par_id IS 'Utilisateur ayant cloturé/résolu l''incident (lu par le trigger fn_notify_arcade_incident_resolu).';
