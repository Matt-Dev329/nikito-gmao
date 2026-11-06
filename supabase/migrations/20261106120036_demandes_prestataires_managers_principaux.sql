-- Demandes spécifiques / prestataires : les managers principaux y ont accès
-- pour leurs parcs (voir, créer, suivre), comme les directeurs de parc.
-- acces_direction_parc n'est pas modifiée : elle protège aussi les contrats
-- et les documents techniques.
CREATE OR REPLACE FUNCTION public.acces_demandes_prestataires(p_parc uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT acces_direction_parc(p_parc) OR (p_parc IS NOT NULL AND p_parc = ANY (parcs_manager_principal()));
$function$;

REVOKE EXECUTE ON FUNCTION public.acces_demandes_prestataires(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_demandes_prestataires(uuid) TO authenticated;

ALTER POLICY demandes_prestataires_lecture ON public.demandes_prestataires
  USING (acces_demandes_prestataires(parc_id));
ALTER POLICY demandes_prestataires_ajout ON public.demandes_prestataires
  WITH CHECK (acces_demandes_prestataires(parc_id));
ALTER POLICY demandes_prestataires_modification ON public.demandes_prestataires
  USING (acces_demandes_prestataires(parc_id))
  WITH CHECK (acces_demandes_prestataires(parc_id));