-- Opérations en lecture seule pour les managers : un manager (principal) ne
-- peut plus supprimer qu'un ticket encore en attente de validation (refus).
CREATE OR REPLACE FUNCTION public.supprimer_ticket(p_incident_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Indique le motif de la suppression';
  END IF;
  IF NOT peut_valider_ticket(p_incident_id) THEN
    RAISE EXCEPTION 'Tu ne peux pas supprimer ce ticket' USING ERRCODE = '42501';
  END IF;
  IF (SELECT current_role_code()) = 'manager_parc'
     AND NOT EXISTS (SELECT 1 FROM incidents WHERE id = p_incident_id AND validation_manager = 'en_attente') THEN
    RAISE EXCEPTION 'Les managers suivent les tickets validés sans les modifier' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents
  SET statut = 'annule',
      validation_manager = CASE WHEN validation_manager = 'en_attente' THEN 'refuse' ELSE validation_manager END,
      supprime_motif = trim(p_motif),
      supprime_par_id = (SELECT current_utilisateur_id()),
      supprime_le = now()
  WHERE id = p_incident_id AND statut <> 'annule';
END;
$function$;
