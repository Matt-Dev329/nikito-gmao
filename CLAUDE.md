# CLAUDE.md — Guide de maintenance « ALBA by Nikito » (GMAO)

> Application de gestion de maintenance des 4 parcs Nikito Group.
> Ce fichier est lu automatiquement par Claude Code. Lis-le en entier avant
> toute action, puis EXPLORE le repo et la base pour confirmer l'état réel
> (ne te fie pas aveuglément à ce texte).

## Identifiants
- **Repo** : `Matt-Dev329/nikito-gmao` — branche de prod : `main`
- **Supabase (prod)** : projet `xhpykmhbahiikqbzwfkc` (« Projet GMAO Nikito »)
- **Hébergement front** : Netlify (projet `nikitech`), domaine `nikito.tech`,
  **auto-déployé à chaque push sur `main`**. Bolt n'est plus dans le circuit.
- **Variables de build** (Netlify) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (clé anon publique, déjà configurée côté Netlify).

## Stack
React 18 + Vite + TypeScript strict + TailwindCSS + TanStack Query + Zustand + PWA.
Backend Supabase : ~61 tables, 137 migrations, ~20 Edge Functions, RLS partout,
pg_cron, pg_net. Auth double : email/mot de passe (profils internes) ET PIN 6
chiffres pour le staff opérationnel (session dans `sessionStorage 'staff_session'`,
accès via clé anon + RPC SECURITY DEFINER).

## Règles d'or (non négociables)
- Vocabulaire 100 % **français** dans l'UI (cf `src/lib/tokens.ts`).
- **Dark mode only**. Couleurs **uniquement** depuis `tailwind.config.js` (jamais de hex en dur).
- Pas de signup public : inscription **uniquement par invitation**.
- Réutiliser le composant générique `ControleEcran` pour toute saisie de points.

## Workflow de travail (impératif)
1. Développe, puis **vérifie systématiquement avant de committer** :
   - `npm run typecheck` (0 erreur)
   - `npm run lint` (0 erreur ; ~30 warnings tolérés)
   - `npm run test` (doit rester vert)
   - `npm run build` (doit passer)
2. Commits clairs en français. Push sur `main` → Netlify redéploie tout seul.
   La CI GitHub Actions rejoue typecheck + lint + test + build.
3. **Ne crée PAS de Pull Request** sauf demande explicite.
4. Tout push sur `main` part **en production** : prudence.

## Discipline migrations (CRITIQUE — repo et base doivent rester synchro)
Quand tu appliques une migration via le MCP Supabase (`apply_migration`), il
enregistre une **version = timestamp au moment de l'application**. Récupère
ensuite cette version :
```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;
```
…et nomme le fichier `supabase/migrations/<version>_<nom>.sql` **à l'identique**,
avec le même SQL. Sinon le check « Supabase Preview » repart en échec
(« Remote migration versions not found in local »).
Le repo est déjà resynchronisé : 137 fichiers = 137 versions en base.

## Patterns & briques en place (à réutiliser, ne pas réinventer)
- **Robustesse** : `ErrorBoundary` global (`src/components/ui/ErrorBoundary.tsx`)
  + Sentry (init conditionnel sur `VITE_SENTRY_DSN` dans `main.tsx`).
- **Offline / anti-perte terrain** : `useOnlineStatus`, `useDraftPersistence` +
  `useAutoSaveDraft`, bandeau `OfflineBanner`. Déjà branchés sur la clôture
  d'intervention, les contrôles staff et le signalement (saisie conservée hors-ligne).
- **Notifications** : `useToast` (`src/components/ui/ToastProvider.tsx`) —
  success / error / info. Ne **pas** utiliser `alert()`.
- **Code-splitting** : routes en `React.lazy` dans `App.tsx` ; vendors séparés
  (Vite `manualChunks`).
- **Types DB générés** : `src/types/database.generated.ts` (fondation). Le client
  Supabase n'est **pas encore typé** (`createClient<Database>` déclenche ~37
  corrections, à faire par lots testés — voir « reste à faire »).

## Pièges connus
- `current_parc_ids()` renvoie `uuid[]` et est utilisé dans `ANY(...)` :
  **ne pas** l'encapsuler dans un sous-SELECT (casse la sémantique). Les autres
  fonctions stables (`auth.uid()`, `current_role_code()`, `current_utilisateur_id()`…)
  **sont déjà** encapsulées en `(SELECT …)` pour la perf RLS (advisor `auth_rls_initplan` = 0).
- Le staff PIN n'a pas d'`auth.uid()` : pour lui faire lire des données soumises à
  RLS, passe par une **RPC SECURITY DEFINER** (cf `valider_controle_staff`,
  `incidents_du_jour_utilisateur`), avec `GRANT EXECUTE … TO anon, authenticated`.
- Trigger arcade : `incidents.resolu_par_id` est lu par
  `fn_notify_arcade_incident_resolu` quand un incident passe en `resolu`.
- Les gros retours du MCP Supabase (> limite) sont **sauvegardés sur disque** ;
  décode-les là-bas (python/base64) plutôt que de les faire transiter par le contexte.
- Lance `get_advisors` (security + performance) après tout changement DDL.

## État de santé actuel
- **Sécurité** : aucune alerte critique (faille RLS `user_role_cache` corrigée).
- **Perf DB** : 0 FK sans index, 0 `auth_rls_initplan`. Reste 39
  `multiple_permissive_policies` (non traité, sensible) + des index récents
  « non encore utilisés » (normal, ils le deviendront à l'usage).
- **Front** : bundle d'entrée ~157 Ko (était 2,2 Mo). CI verte. 26 tests.

## Reste à faire (roadmap — demander validation avant les items sensibles)
1. **Offline lot 3** : file IndexedDB + rejeu auto au retour réseau (photos comprises).
   → nécessite des **tests sur tablette** avant prod.
2. **Consolidation des 39 policies permissives multiples** (sensible : change l'accès,
   tester par rôle ; appliquer de façon atomique + re-vérifier l'advisor).
3. **Adoption complète des types générés** : brancher `createClient<Database>` et
   corriger les ~37 incompatibilités (nullable/enum, null vs undefined dans les RPC,
   payloads insert/update) — par lots testés, en préservant le comportement.
4. **Refactor** des gros composants (`ModaleSignalerV2` ~1200 l., `PageITAdmin` ~1050 l.).
5. **Protection de la branche `main`** (réglage GitHub : exiger la CI verte avant merge).
6. **Audit des ~30 fonctions SECURITY DEFINER** exposées (révoquer l'EXECUTE inutile).

## Démarrage type d'une session
1. Confirme l'accès : liste le repo + les projets Supabase ; vérifie que `main`
   build (`npm install` puis les 4 commandes de vérification).
2. Lance `get_advisors` (security + performance) pour un état des lieux.
3. Pour tout changement sensible (RLS, policies, suppression de données) : explique
   le plan, applique de façon **atomique**, vérifie **immédiatement** après.
