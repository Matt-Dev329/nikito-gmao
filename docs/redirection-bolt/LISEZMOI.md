# Redirection de l'ancienne adresse Bolt vers nikito.tech

L'ancienne adresse `https://matt-dev329-nikito-g-rl0m.bolt.host` sert encore une
vieille version d'ALBA. La base refuse déjà ses requêtes ; ces fichiers
remplacent la page elle-même par un message « Ce lien ne fonctionne plus » avec
un bouton et une redirection automatique (5 s) vers https://nikito.tech.

À faire depuis le compte Bolt (projet publié sur `…bolt.host`) :

1. Remplacer **tout le contenu publié** par ces deux fichiers, à la racine :
   - `index.html` : la page de redirection ;
   - `sw.js` : désinstalle l'ancienne appli gardée en mémoire par les
     téléphones / tablettes (sinon ils continuent d'afficher l'ancienne version).
2. Dans Bolt, si le projet est une appli Vite/React : mettre ces deux fichiers
   dans `public/` et remplacer `src/main.tsx` par une ligne vide (ou supprimer
   le reste du code), puis **Publier**.
3. Vérifier : ouvrir l'ancienne adresse → le message s'affiche puis bascule
   sur nikito.tech.

Les liens d'invitation (`/invitation/…`) et de mot de passe
(`/reset-password`) sont redirigés vers la même page sur nikito.tech.
