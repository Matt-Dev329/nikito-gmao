-- Une réanalyse d'un rapport prestataire reformule parfois les défauts
-- (« Plaque du 3e étage non fixée (écart classe A) » devient « … (obs. 11 –
-- classe A) ») : les levées, rattachées à l'intitulé, se retrouvaient
-- orphelines et tout repassait en non conforme. Après chaque nouvelle
-- analyse, chaque levée orpheline est rattachée au nouveau défaut le plus
-- proche (mêmes mots significatifs), s'il est assez ressemblant et pas déjà
-- levé.

CREATE OR REPLACE FUNCTION public.mots_defaut(p_texte text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Sans la parenthèse finale (référence d'écart), en minuscules, mots de 4 lettres et plus
  SELECT coalesce(array_agg(DISTINCT m), '{}')
  FROM regexp_split_to_table(
         lower(regexp_replace(coalesce(p_texte, ''), '\s*\([^()]*\)\s*$', '')),
         '[^[:alnum:]àâäéèêëîïôöùûüç]+') AS m
  WHERE length(m) >= 4;
$function$;

CREATE OR REPLACE FUNCTION public.fn_levees_suivent_reanalyse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_levee record;
  v_meilleur text;
  v_score numeric;
BEGIN
  IF NEW.points_non_conformes IS NOT DISTINCT FROM OLD.points_non_conformes THEN
    RETURN NEW;
  END IF;
  FOR v_levee IN
    SELECT l.id, l.point_intitule, mots_defaut(l.point_intitule) AS mots
    FROM levees_defauts_prestataires l
    WHERE l.document_id = NEW.document_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.points_non_conformes) p
                      WHERE trim(p->>'intitule') = l.point_intitule)
  LOOP
    SELECT x.intitule, x.score INTO v_meilleur, v_score
    FROM (
      SELECT trim(p->>'intitule') AS intitule,
             (SELECT count(*) FROM unnest(mots_defaut(p->>'intitule')) m WHERE m = ANY (v_levee.mots))::numeric
               / greatest(1, (SELECT count(DISTINCT m) FROM unnest(mots_defaut(p->>'intitule') || v_levee.mots) m)) AS score
      FROM jsonb_array_elements(NEW.points_non_conformes) p
      WHERE NOT EXISTS (SELECT 1 FROM levees_defauts_prestataires l2
                        WHERE l2.document_id = NEW.document_id AND l2.point_intitule = trim(p->>'intitule'))
    ) x
    ORDER BY x.score DESC
    LIMIT 1;
    IF v_meilleur IS NOT NULL AND v_score >= 0.4 THEN
      UPDATE levees_defauts_prestataires SET point_intitule = v_meilleur WHERE id = v_levee.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_levees_suivent_reanalyse() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER analyses_prestataires_levees_suivent AFTER UPDATE OF points_non_conformes
  ON public.analyses_rapports_prestataires
  FOR EACH ROW EXECUTE FUNCTION fn_levees_suivent_reanalyse();
