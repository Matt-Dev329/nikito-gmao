/*
  # Plans et manuels : fichiers lourds

  Le bucket `alba-techniques` passe de 50 Mo à 500 Mo par fichier
  (plans haute définition, manuels scannés). L'envoi des gros fichiers se
  fait par morceaux (upload reprenable TUS) côté application.
*/

UPDATE storage.buckets
   SET file_size_limit = 524288000
 WHERE id = 'alba-techniques';
