/*
  # Vidéos au signalement

  Le stockage des médias de signalement (alba-incidents) accepte aussi les
  vidéos prises au téléphone / à la tablette (mp4, mov, webm, 3gp), jusqu'à
  50 Mo (environ 30 s). Les photos restent acceptées comme avant.
*/

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
         'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
       ],
       file_size_limit = 52428800
 WHERE id = 'alba-incidents';
