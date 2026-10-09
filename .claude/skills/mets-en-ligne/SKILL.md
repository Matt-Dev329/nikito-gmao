---
name: mets-en-ligne
description: Met en production (nikito.tech) le travail en cours — vérifie, committe, pousse sur main et contrôle la CI. À utiliser quand l'utilisateur tape /mets-en-ligne ou dit « mets en ligne ».
---

# Mettre en ligne (production nikito.tech)

L'utilisateur demande explicitement la mise en production : c'est l'autorisation
de pousser sur `main` (Netlify redéploie automatiquement nikito.tech).

1. **État** : `git status` et `git fetch origin main`. Si rien n'est à envoyer
   (arbre propre et `origin/main..HEAD` vide), dis-le simplement : c'est déjà en ligne.
2. **Base de données** : si des migrations ont été appliquées via le MCP Supabase,
   vérifie que chaque version de `supabase_migrations.schema_migrations` a son fichier
   `supabase/migrations/<version>_<nom>.sql` (cf. CLAUDE.md). Sinon, crée-le avant de continuer.
3. **Vérifications** (toutes doivent passer, sinon on s'arrête et on explique) :
   `npm run typecheck`, `npm run lint` (0 erreur), `npm run test`, `npm run build`.
4. **Commit** des changements en cours avec un message clair en français.
5. **Synchronisation** : si `origin/main` a avancé, merge-le (pas de rebase/force-push),
   relance les vérifications.
6. **Push** : `git push origin HEAD:main`, puis aussi sur la branche de travail.
7. **CI** : vérifie le run GitHub Actions « CI » du commit sur `main`
   (MCP GitHub `actions_list`). S'il échoue, diagnostique et corrige.
8. **Compte rendu** en français simple : ce qui est parti en ligne, et rappeler de
   recharger nikito.tech (Ctrl+Shift+R, ou fermer/rouvrir l'appli sur tablette).
