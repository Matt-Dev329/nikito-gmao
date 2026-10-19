-- Rapports prestataires : les fichiers (prestataire/<CODE PARC>/… ou
-- prestataire/commun/…) ne sont lisibles et déposables que par ceux qui ont
-- accès à ce parc (acces_pilotage_parc), comme les rapports eux-mêmes.
-- Code de parc inconnu : accès réservé à la direction / chef d'équipe / admin IT.
CREATE OR REPLACE FUNCTION public.acces_fichier_prestataire(p_chemin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT acces_pilotage_parc(
    CASE
      WHEN split_part(p_chemin, '/', 2) = 'commun' THEN NULL
      ELSE coalesce((SELECT id FROM parcs WHERE code = split_part(p_chemin, '/', 2)),
                    '00000000-0000-0000-0000-000000000000'::uuid)
    END
  );
$function$;
REVOKE ALL ON FUNCTION public.acces_fichier_prestataire(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_fichier_prestataire(text) TO authenticated;

ALTER POLICY alba_techniques_lecture ON storage.objects
  USING ((bucket_id = 'alba-techniques'::text) AND (((name !~~ 'prestataire/%'::text) AND ((( SELECT current_role_code() AS current_role_code))::text = ANY (ARRAY['direction'::text, 'chef_maintenance'::text, 'directeur_parc'::text, 'manager_parc'::text, 'technicien'::text, 'admin_it'::text]))) OR ((name ~~ 'prestataire/%'::text) AND acces_fichier_prestataire(name))));

ALTER POLICY alba_techniques_ajout ON storage.objects
  WITH CHECK ((bucket_id = 'alba-techniques'::text) AND (((name !~~ 'prestataire/%'::text) AND ((( SELECT current_role_code() AS current_role_code))::text = ANY (ARRAY['direction'::text, 'chef_maintenance'::text, 'directeur_parc'::text, 'manager_parc'::text, 'technicien'::text, 'admin_it'::text]))) OR ((name ~~ 'prestataire/%'::text) AND acces_fichier_prestataire(name))));
