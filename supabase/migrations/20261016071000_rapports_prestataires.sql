/*
  # Rapports des prestataires extérieurs

  Nouvel onglet « Rapports prestataires » : comptes rendus des prestataires
  qui interviennent dans les parcs (extincteurs, électricité, SSI…).
  Réutilise la table `documents_techniques` et le bucket `alba-techniques`
  (mêmes droits que plans et manuels) :
  1. nouveau type 'prestataire' ;
  2. colonnes `prestataire` (société), `date_document` (date d'intervention),
     `prochaine_echeance` (prochaine visite, pour les alertes visuelles).
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

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016071000', 'rapports_prestataires')
ON CONFLICT (version) DO NOTHING;
