-- Blessés : suppression d'une déclaration par le chef d'équipe (motif
-- obligatoire). Suppression « douce » : la ligne est gardée et masquée du
-- registre (supprime_le), jamais effacée.
ALTER TABLE public.declarations_blesses
  ADD COLUMN supprime_le timestamptz,
  ADD COLUMN supprime_par_id uuid REFERENCES public.utilisateurs(id),
  ADD COLUMN supprime_motif text;
CREATE INDEX declarations_blesses_supprime_par_idx ON public.declarations_blesses(supprime_par_id);

CREATE OR REPLACE FUNCTION public.supprimer_blesse(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moi uuid := current_utilisateur_id();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF current_role_code()::text IS DISTINCT FROM 'chef_maintenance' THEN
    RAISE EXCEPTION 'Suppression réservée au chef d''équipe' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_motif, ''))) < 3 THEN
    RAISE EXCEPTION 'Motif de suppression obligatoire';
  END IF;
  UPDATE declarations_blesses
     SET supprime_le = now(), supprime_par_id = v_moi, supprime_motif = left(trim(p_motif), 500)
   WHERE id = p_id AND supprime_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déclaration introuvable ou déjà supprimée';
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.supprimer_blesse(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_blesse(uuid, text) TO authenticated;