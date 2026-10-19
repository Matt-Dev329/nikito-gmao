-- Levée des défauts d'un rapport prestataire : chaque point non conforme peut
-- être levé avec une attestation / un compte rendu d'intervention (fichier dans
-- alba-techniques, sous prestataire/). Même droits que la lecture du rapport
-- (acces_pilotage_parc). Une levée annulée reste tracée (statut 'annulee').

CREATE TABLE IF NOT EXISTS public.levees_defauts_prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents_techniques(id) ON DELETE CASCADE,
  point_intitule text NOT NULL,
  statut text NOT NULL DEFAULT 'levee' CHECK (statut IN ('levee', 'annulee')),
  justification text,
  attestation_chemin text,
  attestation_nom text,
  attestation_mime text,
  leve_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  leve_par_nom text,
  leve_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, point_intitule)
);
CREATE INDEX IF NOT EXISTS idx_levees_defauts_leve_par ON public.levees_defauts_prestataires(leve_par_id);

ALTER TABLE public.levees_defauts_prestataires ENABLE ROW LEVEL SECURITY;

CREATE POLICY levees_defauts_lecture ON public.levees_defauts_prestataires
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documents_techniques d
    WHERE d.id = document_id AND acces_pilotage_parc(d.parc_id)
  )
);

CREATE OR REPLACE FUNCTION public.lever_defauts_prestataire(
  p_document_id uuid,
  p_points jsonb,
  p_attestation_chemin text,
  p_attestation_nom text,
  p_attestation_mime text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parc uuid;
  v_moi uuid := (SELECT current_utilisateur_id());
  v_nom text;
  v_point jsonb;
  v_intitule text;
  v_n integer := 0;
BEGIN
  SELECT parc_id INTO v_parc FROM documents_techniques WHERE id = p_document_id AND type = 'prestataire' AND actif;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapport prestataire introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_parc) THEN
    RAISE EXCEPTION 'Accès refusé à ce rapport' USING ERRCODE = '42501';
  END IF;
  IF p_attestation_chemin IS NULL OR p_attestation_chemin NOT LIKE 'prestataire/%' THEN
    RAISE EXCEPTION 'Attestation ou compte rendu obligatoire';
  END IF;
  IF jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) = 0 THEN
    RAISE EXCEPTION 'Aucun défaut à lever';
  END IF;

  SELECT trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) INTO v_nom FROM utilisateurs WHERE id = v_moi;

  FOR v_point IN SELECT * FROM jsonb_array_elements(p_points) LOOP
    v_intitule := trim(v_point->>'intitule');
    -- Seulement un point non conforme de l'analyse de ce rapport
    IF NOT EXISTS (
      SELECT 1 FROM analyses_rapports_prestataires a,
           LATERAL jsonb_array_elements(a.points_non_conformes) p
      WHERE a.document_id = p_document_id AND trim(p->>'intitule') = v_intitule
    ) THEN
      RAISE EXCEPTION 'Défaut inconnu pour ce rapport : %', v_intitule;
    END IF;
    INSERT INTO levees_defauts_prestataires (document_id, point_intitule, statut, justification,
      attestation_chemin, attestation_nom, attestation_mime, leve_par_id, leve_par_nom, leve_le)
    VALUES (p_document_id, v_intitule, 'levee', left(v_point->>'justification', 1000),
      p_attestation_chemin, left(p_attestation_nom, 200), p_attestation_mime, v_moi, v_nom, now())
    ON CONFLICT (document_id, point_intitule) DO UPDATE
      SET statut = 'levee', justification = EXCLUDED.justification,
          attestation_chemin = EXCLUDED.attestation_chemin, attestation_nom = EXCLUDED.attestation_nom,
          attestation_mime = EXCLUDED.attestation_mime, leve_par_id = EXCLUDED.leve_par_id,
          leve_par_nom = EXCLUDED.leve_par_nom, leve_le = EXCLUDED.leve_le;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.annuler_levee_defaut(p_levee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parc uuid;
BEGIN
  SELECT d.parc_id INTO v_parc
  FROM levees_defauts_prestataires l JOIN documents_techniques d ON d.id = l.document_id
  WHERE l.id = p_levee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Levée introuvable';
  END IF;
  IF NOT acces_pilotage_parc(v_parc) THEN
    RAISE EXCEPTION 'Accès refusé à ce rapport' USING ERRCODE = '42501';
  END IF;
  UPDATE levees_defauts_prestataires SET statut = 'annulee' WHERE id = p_levee_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.lever_defauts_prestataire(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annuler_levee_defaut(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lever_defauts_prestataire(uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_levee_defaut(uuid) TO authenticated;
