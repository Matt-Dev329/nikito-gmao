/*
  # Correction des droits d'écriture sur parcs_utilisateurs

  Contexte : un chef de maintenance (ex. Ryad) ne pouvait pas créer de compte
  staff avec code PIN. La création passe par 3 écritures : `utilisateurs`,
  `parcs_utilisateurs` (lien parc↔utilisateur), puis `invitations`.
  Les tables `utilisateurs` et `invitations` autorisent déjà
  direction / chef_maintenance / directeur_parc en écriture, mais
  `parcs_utilisateurs` était restreinte à `direction` uniquement
  (policy `pu_ecriture_direction`). L'insertion du lien parc échouait donc
  pour les autres gestionnaires → PIN impossible à générer.

  Correction : on remplace `pu_ecriture_direction` par
  `pu_ecriture_gestionnaires`, alignée sur les autres tables :
    - direction / chef_maintenance / directeur_parc : accès complet
    - manager_parc : accès limité à ses propres parcs (parc_id ∈ current_parc_ids())

  Note perf : current_role_code() est encapsulé en (SELECT …) pour l'advisor
  auth_rls_initplan. current_parc_ids() renvoie un uuid[] utilisé dans ANY(...) :
  il ne doit PAS être encapsulé (casse la sémantique du =).
*/

DROP POLICY IF EXISTS pu_ecriture_direction ON public.parcs_utilisateurs;

CREATE POLICY pu_ecriture_gestionnaires ON public.parcs_utilisateurs
  FOR ALL TO authenticated
  USING (
    (SELECT current_role_code()) = ANY (ARRAY['direction','chef_maintenance','directeur_parc']::role_utilisateur[])
    OR ((SELECT current_role_code()) = 'manager_parc'::role_utilisateur AND parc_id = ANY (current_parc_ids()))
  )
  WITH CHECK (
    (SELECT current_role_code()) = ANY (ARRAY['direction','chef_maintenance','directeur_parc']::role_utilisateur[])
    OR ((SELECT current_role_code()) = 'manager_parc'::role_utilisateur AND parc_id = ANY (current_parc_ids()))
  );
