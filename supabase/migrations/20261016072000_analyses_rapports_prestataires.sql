/*
  # Analyse automatique des rapports prestataires (chef d'équipe, directeurs de parc)

  Pour chaque rapport prestataire déposé (documents_techniques type
  'prestataire'), la fonction Edge `analyser-rapport-prestataire` lit le
  document avec Claude et enregistre ici :
  - le résultat global, un résumé, les points conformes et non conformes
    (avec gravité et action à mener) ;
  - la date du contrôle et la date de renouvellement (prochaine échéance),
    reportée sur le document si elle n'était pas saisie.

  1. Table `analyses_rapports_prestataires` — lecture : chef d'équipe (tous
     parcs) et directeurs de parc (leurs parcs) ; écriture par la fonction
     Edge (service).
  2. RPC `relancer_analyse_prestataire(p_document_id)` : remet l'analyse
     « en attente », l'appli relance ensuite la fonction.
  3. Alertes de renouvellement : `alertes_echeances_prestataires()` notifie
     les chefs d'équipe et le directeur du parc concerné à J-30, J-7, J-1,
     le jour J et le lendemain d'une échéance dépassée ; pg_cron chaque
     matin (05h05 UTC).
  Script rejouable.
*/

CREATE TABLE IF NOT EXISTS public.analyses_rapports_prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.documents_techniques(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'terminee', 'echec')),
  resultat_global text CHECK (resultat_global IN ('conforme', 'conforme_avec_reserves', 'non_conforme', 'indetermine')),
  resume text,
  points_conformes jsonb NOT NULL DEFAULT '[]'::jsonb,
  points_non_conformes jsonb NOT NULL DEFAULT '[]'::jsonb,
  date_controle date,
  prochaine_echeance date,
  periodicite text,
  prestataire_detecte text,
  erreur text,
  modele text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  analyse_le timestamptz
);
CREATE INDEX IF NOT EXISTS idx_analyses_prestataires_echeance
  ON public.analyses_rapports_prestataires(prochaine_echeance);

ALTER TABLE public.analyses_rapports_prestataires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analyses_prestataires_lecture ON public.analyses_rapports_prestataires;
CREATE POLICY analyses_prestataires_lecture ON public.analyses_rapports_prestataires
FOR SELECT TO authenticated
USING (
  (SELECT current_role_code())::text = 'chef_maintenance'
  OR (
    (SELECT current_role_code())::text = 'directeur_parc'
    AND EXISTS (
      SELECT 1 FROM documents_techniques d
      WHERE d.id = document_id AND (d.parc_id IS NULL OR d.parc_id = ANY (current_parc_ids()))
    )
  )
);

CREATE OR REPLACE FUNCTION public.relancer_analyse_prestataire(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF (SELECT current_role_code())::text NOT IN ('chef_maintenance', 'directeur_parc') THEN
    RAISE EXCEPTION 'Réservé au chef d''équipe et aux directeurs de parc' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM documents_techniques WHERE id = p_document_id AND type = 'prestataire' AND actif) THEN
    RAISE EXCEPTION 'Rapport prestataire introuvable';
  END IF;
  INSERT INTO analyses_rapports_prestataires (document_id, statut)
  VALUES (p_document_id, 'en_attente')
  ON CONFLICT (document_id) DO UPDATE SET statut = 'en_attente', erreur = NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.relancer_analyse_prestataire(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relancer_analyse_prestataire(uuid) TO authenticated;

-- Alertes de renouvellement des contrôles prestataires
CREATE OR REPLACE FUNCTION public.alertes_echeances_prestataires()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_doc record;
  v_chef record;
  v_jours integer;
  v_titre text;
  v_nb integer := 0;
BEGIN
  FOR v_doc IN
    SELECT d.id, d.titre, d.activite, d.prestataire, d.parc_id, p.code AS parc_code,
           COALESCE(d.prochaine_echeance, a.prochaine_echeance) AS echeance
    FROM documents_techniques d
    LEFT JOIN analyses_rapports_prestataires a ON a.document_id = d.id
    LEFT JOIN parcs p ON p.id = d.parc_id
    WHERE d.type = 'prestataire' AND d.actif
      AND COALESCE(d.prochaine_echeance, a.prochaine_echeance) IS NOT NULL
  LOOP
    v_jours := v_doc.echeance - v_aujourdhui;
    CONTINUE WHEN v_jours NOT IN (30, 7, 1, 0, -1);
    -- Un renouvellement plus récent du même domaine / parc remplace l'ancien
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM documents_techniques d2
      WHERE d2.type = 'prestataire' AND d2.actif AND d2.id <> v_doc.id
        AND COALESCE(d2.activite, '') = COALESCE(v_doc.activite, '')
        AND d2.cree_le > (SELECT cree_le FROM documents_techniques WHERE id = v_doc.id)
        AND COALESCE(d2.prochaine_echeance, v_doc.echeance + 1) > v_doc.echeance
    );
    v_titre := CASE
      WHEN v_jours < 0 THEN 'Contrôle dépassé : ' || COALESCE(v_doc.activite, v_doc.titre)
      WHEN v_jours = 0 THEN 'Contrôle à renouveler aujourd''hui : ' || COALESCE(v_doc.activite, v_doc.titre)
      ELSE 'Contrôle à renouveler dans ' || v_jours || ' j : ' || COALESCE(v_doc.activite, v_doc.titre)
    END;
    FOR v_chef IN
      SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
      WHERE u.actif
        AND (
          r.code = 'chef_maintenance'
          OR (r.code = 'directeur_parc' AND (v_doc.parc_id IS NULL OR EXISTS (
            SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.parc_id = v_doc.parc_id
          )))
        )
    LOOP
      PERFORM notifier_push(
        v_chef.id,
        v_titre,
        concat_ws(' · ', v_doc.parc_code, v_doc.prestataire, 'échéance ' || to_char(v_doc.echeance, 'DD/MM/YYYY')),
        '/gmao/analyses-prestataires'
      );
      v_nb := v_nb + 1;
    END LOOP;
  END LOOP;
  RETURN v_nb;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertes_echeances_prestataires() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'gmao_alertes_echeances_prestataires',
  '5 5 * * *',
  $cron$SELECT public.alertes_echeances_prestataires();$cron$
);

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016072000', 'analyses_rapports_prestataires')
ON CONFLICT (version) DO NOTHING;
