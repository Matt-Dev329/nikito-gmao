/*
  # Activer RLS sur user_role_cache (correctif sécurité)

  1. Problème
    - `public.user_role_cache` avait RLS désactivé (créée ainsi volontairement
      pour casser la récursion infinie des policies de `utilisateurs`).
    - Conséquence : la table était exposée en lecture/écriture à n'importe qui
      possédant la clé anon (advisor Supabase niveau ERROR `rls_disabled_in_public`).

  2. Analyse de sûreté
    - Tous les accès à `user_role_cache` (7 policies sur utilisateurs/webauthn_credentials
      + fonctions current_role_code/current_utilisateur_id) filtrent systématiquement
      sur `auth_user_id = auth.uid()` -> une policy "chacun voit uniquement sa ligne"
      préserve 100 % du comportement.
    - Les écritures passent exclusivement par le trigger `sync_user_role_cache`
      (SECURITY DEFINER, row_security off) -> aucune écriture client à autoriser.
    - La policy ne référence que `auth.uid()` et la colonne propre de la table :
      aucune récursion réintroduite.
    - Le front ne lit jamais cette table directement.

  3. Effet
    - Lecture restreinte à sa propre ligne (anon/authenticated). Pour anon,
      `auth.uid()` est NULL -> 0 ligne, identique au comportement actuel.
    - Toute écriture client est bloquée (durcissement voulu).
*/

ALTER TABLE public.user_role_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_role_cache_select_own" ON public.user_role_cache;
CREATE POLICY "user_role_cache_select_own" ON public.user_role_cache
  FOR SELECT
  TO anon, authenticated
  USING (auth_user_id = auth.uid());
