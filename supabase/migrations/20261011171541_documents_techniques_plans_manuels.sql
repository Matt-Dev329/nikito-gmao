/*
  # Plans et manuels techniques

  1. Bucket privé `alba-techniques` (PDF et images, 50 Mo max).
  2. Table `documents_techniques` : type 'plan' (plans des parcs, plans des
     trampolines…, rangés par parc) ou 'manuel' (manuels d'activité, rangés
     par activité), titre, description, fichier.
  3. Accès : lecture pour tous les rôles sauf staff opérationnel ; ajout et
     retrait (masquage, pas de suppression) pour direction, chef d'équipe,
     directeur de parc et admin IT.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('alba-techniques', 'alba-techniques', false, 52428800,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "alba_techniques_lecture" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'alba-techniques'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it')
);

CREATE POLICY "alba_techniques_ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'alba-techniques'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it')
);

CREATE TABLE IF NOT EXISTS public.documents_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('plan', 'manuel')),
  parc_id uuid REFERENCES public.parcs(id) ON DELETE SET NULL,
  activite text,
  titre text NOT NULL,
  description text,
  chemin text NOT NULL,
  mime text,
  taille integer,
  actif boolean NOT NULL DEFAULT true,
  cree_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_techniques_type ON public.documents_techniques(type) WHERE actif;
CREATE INDEX IF NOT EXISTS idx_documents_techniques_parc ON public.documents_techniques(parc_id);
CREATE INDEX IF NOT EXISTS idx_documents_techniques_cree_par ON public.documents_techniques(cree_par_id);

ALTER TABLE public.documents_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_techniques_lecture ON public.documents_techniques FOR SELECT TO authenticated
USING ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'));

CREATE POLICY documents_techniques_ajout ON public.documents_techniques FOR INSERT TO authenticated
WITH CHECK ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'));

CREATE POLICY documents_techniques_modification ON public.documents_techniques FOR UPDATE TO authenticated
USING ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'))
WITH CHECK ((SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it'));
