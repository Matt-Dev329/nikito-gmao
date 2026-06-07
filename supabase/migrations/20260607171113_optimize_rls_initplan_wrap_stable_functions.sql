/*
  # Optimisation RLS — encapsuler les fonctions stables (advisor auth_rls_initplan)

  41 policies réévaluaient `auth.uid()` / `current_setting()` / les helpers
  (current_role_code, current_utilisateur_id) à CHAQUE ligne, ce qui dégrade les
  performances quand les tables grossissent.

  Correctif : encapsuler ces appels dans un sous-SELECT `(SELECT f())` pour qu'ils
  soient évalués UNE fois par requête. Transformation sémantiquement identique
  (recommandation officielle Supabase). `ALTER POLICY` préserve rôles / commande /
  caractère permissif. Migration atomique : si une seule policy échoue, tout est annulé.

  Note : current_parc_ids() est volontairement EXCLU (retourne uuid[], utilisé dans
  ANY() — l'encapsuler casserait la sémantique). Résultat vérifié : auth_rls_initplan
  passe de 41 à 0.
*/
DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
  fn text;
  fns text[] := ARRAY['auth.uid()','auth.role()','auth.jwt()','auth.email()',
                      'current_role_code()','current_utilisateur_id()'];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ~ '(auth\.(uid|role|jwt|email)\(\)|current_setting\(|current_role_code\(\)|current_utilisateur_id\(\))'
        OR with_check ~ '(auth\.(uid|role|jwt|email)\(\)|current_setting\(|current_role_code\(\)|current_utilisateur_id\(\))'
      )
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;

    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, 'current_setting\(([^()]*)\)', '(SELECT current_setting(\1))', 'g');
      FOREACH fn IN ARRAY fns LOOP
        v_qual := replace(v_qual, fn, '(SELECT ' || fn || ')');
      END LOOP;
    END IF;

    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, 'current_setting\(([^()]*)\)', '(SELECT current_setting(\1))', 'g');
      FOREACH fn IN ARRAY fns LOOP
        v_check := replace(v_check, fn, '(SELECT ' || fn || ')');
      END LOOP;
    END IF;

    v_sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF v_qual IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual); END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;
