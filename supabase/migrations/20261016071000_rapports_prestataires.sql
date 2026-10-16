/*
  # Rapports des prestataires extérieurs

  Nouvel onglet « Rapports prestataires » : comptes rendus des prestataires
  qui interviennent dans les parcs (extincteurs, électricité, SSI…).
  Réutilise la table `documents_techniques` et le bucket `alba-techniques` :
  1. nouveau type 'prestataire' ;
  2. colonnes `prestataire` (société), `date_document` (date d'intervention),
     `prochaine_echeance` (prochaine visite, pour les alertes visuelles) ;
  3. accès aux rapports prestataires réservé au chef d'équipe (tous parcs)
     et aux directeurs de parc (leurs parcs) — table et fichiers
     (`prestataire/…`) ; plans et manuels inchangés.
  Script rejouable.
*/

ALTER TABLE public.documents_techniques DROP CONSTRAINT IF EXISTS documents_techniques_type_check;
ALTER TABLE public.documents_techniques
  ADD CONSTRAINT documents_techniques_type_check CHECK (type IN ('plan', 'manuel', 'prestataire'));

ALTER TABLE public.documents_techniques
  ADD COLUMN IF NOT EXISTS prestataire text,
  ADD COLUMN IF NOT EXISTS date_document date,
  ADD COLUMN IF NOT EXISTS prochaine_echeance date;

CREATE INDEX IF NOT EXISTS idx_documents_techniques_echeance
  ON public.documents_techniques(prochaine_echeance) WHERE actif AND type = 'prestataire';

-- Droits : plans / manuels inchangés, rapports prestataires restreints
DROP POLICY IF EXISTS documents_techniques_lecture ON public.documents_techniques;
CREATE POLICY documents_techniques_lecture ON public.documents_techniques FOR SELECT TO authenticated
USING (
  (type <> 'prestataire'
    AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'))
  OR (type = 'prestataire' AND (
    (SELECT current_role_code())::text = 'chef_maintenance'
    OR ((SELECT current_role_code())::text = 'directeur_parc' AND (parc_id IS NULL OR parc_id = ANY (current_parc_ids())))
  ))
);

DROP POLICY IF EXISTS documents_techniques_ajout ON public.documents_techniques;
CREATE POLICY documents_techniques_ajout ON public.documents_techniques FOR INSERT TO authenticated
WITH CHECK (
  (type <> 'prestataire'
    AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
  OR (type = 'prestataire' AND (SELECT current_role_code())::text IN ('chef_maintenance', 'directeur_parc'))
);

DROP POLICY IF EXISTS documents_techniques_modification ON public.documents_techniques;
CREATE POLICY documents_techniques_modification ON public.documents_techniques FOR UPDATE TO authenticated
USING (
  (type <> 'prestataire'
    AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
  OR (type = 'prestataire' AND (SELECT current_role_code())::text IN ('chef_maintenance', 'directeur_parc'))
)
WITH CHECK (
  (type <> 'prestataire'
    AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
  OR (type = 'prestataire' AND (SELECT current_role_code())::text IN ('chef_maintenance', 'directeur_parc'))
);

DROP POLICY IF EXISTS "alba_techniques_lecture" ON storage.objects;
CREATE POLICY "alba_techniques_lecture" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'alba-techniques'
  AND (
    (name NOT LIKE 'prestataire/%'
      AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'))
    OR (name LIKE 'prestataire/%' AND (SELECT current_role_code())::text IN ('chef_maintenance', 'directeur_parc'))
  )
);

DROP POLICY IF EXISTS "alba_techniques_ajout" ON storage.objects;
CREATE POLICY "alba_techniques_ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'alba-techniques'
  AND (
    (name NOT LIKE 'prestataire/%'
      AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
    OR (name LIKE 'prestataire/%' AND (SELECT current_role_code())::text IN ('chef_maintenance', 'directeur_parc'))
  )
);

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016071000', 'rapports_prestataires')
ON CONFLICT (version) DO NOTHING;
