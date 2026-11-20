-- Technicien Karting : photos des tickets et des interventions limitées à
-- ses tickets (karting). Les sous-requêtes passent par ses propres droits,
-- donc ne trouvent que les tickets karting.
CREATE POLICY technicien_karting_photos ON storage.objects AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    NOT (SELECT est_technicien_karting())
    OR bucket_id NOT IN ('alba-incidents', 'alba-interventions')
    OR (bucket_id = 'alba-incidents'
        AND EXISTS (SELECT 1 FROM public.incidents i WHERE storage.objects.name = ANY (i.photos_urls::text[])))
    OR (bucket_id = 'alba-interventions'
        AND (EXISTS (SELECT 1 FROM public.incidents i WHERE i.numero_bt = split_part(storage.objects.name, '/', 2))
             OR EXISTS (SELECT 1 FROM public.interventions iv
                        WHERE storage.objects.name = ANY (coalesce(iv.photos_avant, '{}'::text[]) || coalesce(iv.photos_apres, '{}'::text[]))
                           OR storage.objects.name IN (iv.signature_url, iv.signature_binome_url))))
  );