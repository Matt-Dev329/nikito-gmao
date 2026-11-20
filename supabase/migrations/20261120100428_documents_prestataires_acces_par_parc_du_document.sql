-- Rapports prestataires et contrats : l'accès au fichier suit le parc
-- enregistré sur le document (modifiable), et non plus le parc écrit dans le
-- chemin du fichier au moment de l'envoi. Gros fichiers découpés (.partNNN)
-- compris. Sans document correspondant : règle d'avant (parc du chemin).
CREATE INDEX IF NOT EXISTS idx_documents_techniques_chemin ON public.documents_techniques (chemin);

CREATE OR REPLACE FUNCTION public.acces_fichier_prestataire(p_chemin text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH doc AS (
    SELECT d.parc_id FROM documents_techniques d
    WHERE d.chemin = regexp_replace(p_chemin, '\.part[0-9]{3}$', '')
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM doc) THEN acces_pilotage_parc((SELECT parc_id FROM doc))
    ELSE acces_pilotage_parc(
      CASE
        WHEN split_part(p_chemin, '/', 2) = 'commun' THEN NULL
        ELSE coalesce((SELECT id FROM parcs WHERE code = split_part(p_chemin, '/', 2)),
                      '00000000-0000-0000-0000-000000000000'::uuid)
      END)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.acces_fichier_direction(p_chemin text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH doc AS (
    SELECT d.parc_id FROM documents_techniques d
    WHERE split_part(p_chemin, '/', 1) = 'contrat'
      AND d.chemin = regexp_replace(p_chemin, '\.part[0-9]{3}$', '')
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM doc) THEN acces_direction_parc((SELECT parc_id FROM doc))
    ELSE acces_direction_parc(
      CASE
        WHEN split_part(p_chemin, '/', 2) = 'commun' THEN NULL
        ELSE coalesce((SELECT id FROM parcs WHERE code = split_part(p_chemin, '/', 2)),
                      '00000000-0000-0000-0000-000000000000'::uuid)
      END)
  END;
$function$;