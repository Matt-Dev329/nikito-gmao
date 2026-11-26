-- Pièce jointe d'une demande prestataire (demande/<PARC>/...) : déposée par
-- quiconque peut créer la demande sur ce parc (dont les managers de parc).
CREATE POLICY alba_demandes_ajout ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'alba-techniques'
    AND name LIKE 'demande/%'
    AND acces_demandes_prestataires(COALESCE((SELECT p.id FROM public.parcs p WHERE p.code = split_part(name, '/', 2)), '00000000-0000-0000-0000-000000000000'::uuid))
  );
