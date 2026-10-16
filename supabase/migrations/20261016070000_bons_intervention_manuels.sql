/*
  # Bons d'intervention (réparations hors ticket)

  Bon rempli à la main pour une réparation réalisée sans ticket : parc,
  activité, équipement, problème constaté, travaux réalisés, pièces, durée,
  photos / vidéos, signature du technicien et signature du responsable.

  1. Bucket privé `alba-bons` (photos, vidéos, signatures PNG — 50 Mo).
  2. Table `bons_intervention` + numéro automatique BI-AAAA-00001.
  3. Accès : tous les rôles sauf staff opérationnel. Lecture : direction,
     chef d'équipe, admin IT (tout) ; directeur de parc, manager,
     technicien (leurs parcs). Création par ces mêmes rôles, pour soi.
     Pas de suppression (retrait = actif false, par les chefs).
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('alba-bons', 'alba-bons', false, 52428800,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "alba_bons_lecture" ON storage.objects;
CREATE POLICY "alba_bons_lecture" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'alba-bons'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it')
);

DROP POLICY IF EXISTS "alba_bons_ajout" ON storage.objects;
CREATE POLICY "alba_bons_ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'alba-bons'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it')
);

CREATE SEQUENCE IF NOT EXISTS public.bons_intervention_numero_seq;

CREATE TABLE IF NOT EXISTS public.bons_intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  parc_id uuid REFERENCES public.parcs(id) ON DELETE SET NULL,
  activite text,
  equipement text,
  date_intervention timestamptz NOT NULL DEFAULT now(),
  duree_minutes integer CHECK (duree_minutes IS NULL OR duree_minutes >= 0),
  probleme text,
  travaux text NOT NULL,
  pieces text,
  medias text[] NOT NULL DEFAULT '{}',
  technicien_nom text NOT NULL,
  signature_technicien text NOT NULL,
  responsable_nom text NOT NULL,
  signature_responsable text NOT NULL,
  est_formation boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  cree_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bons_intervention_parc ON public.bons_intervention(parc_id);
CREATE INDEX IF NOT EXISTS idx_bons_intervention_cree_par ON public.bons_intervention(cree_par_id);
CREATE INDEX IF NOT EXISTS idx_bons_intervention_date ON public.bons_intervention(date_intervention DESC) WHERE actif;

CREATE OR REPLACE FUNCTION public.fn_bons_intervention_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'BI-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-'
      || lpad(nextval('bons_intervention_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bons_intervention_numero ON public.bons_intervention;
CREATE TRIGGER trg_bons_intervention_numero
BEFORE INSERT ON public.bons_intervention
FOR EACH ROW EXECUTE FUNCTION public.fn_bons_intervention_numero();

ALTER TABLE public.bons_intervention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bons_intervention_lecture ON public.bons_intervention;
CREATE POLICY bons_intervention_lecture ON public.bons_intervention FOR SELECT TO authenticated
USING (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
  OR (
    (SELECT current_role_code())::text IN ('directeur_parc', 'manager_parc', 'technicien')
    AND (parc_id IS NULL OR parc_id = ANY (current_parc_ids()) OR cree_par_id = (SELECT current_utilisateur_id()))
  )
);

DROP POLICY IF EXISTS bons_intervention_ajout ON public.bons_intervention;
CREATE POLICY bons_intervention_ajout ON public.bons_intervention FOR INSERT TO authenticated
WITH CHECK (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it')
  AND cree_par_id = (SELECT current_utilisateur_id())
);

DROP POLICY IF EXISTS bons_intervention_retrait ON public.bons_intervention;
CREATE POLICY bons_intervention_retrait ON public.bons_intervention FOR UPDATE TO authenticated
USING ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
WITH CHECK ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'));

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016070000', 'bons_intervention_manuels')
ON CONFLICT (version) DO NOTHING;
