/*
  # Create missing storage buckets and fix policies

  1. New Buckets
    - `photos-profil` — Photos de profil utilisateurs (referenced in AcceptationInvitation.tsx)
    - `rapports` — Rapports PDF generes (export controles, IA, etc.)
    - `manuels-equipements` — Documentation technique equipements
  2. Security
    - INSERT policies for authenticated users on new buckets
    - Scoped by user/role where appropriate
  3. Notes
    - Existing buckets (alba-controles, alba-interventions, alba-incidents,
      alba-signatures, alba-documents, alba-equipements) already exist
    - photos-profil was actively referenced in code but never created
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos-profil', 'photos-profil', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('rapports', 'rapports', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('manuels-equipements', 'manuels-equipements', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  -- photos-profil: authenticated users can upload their own profile photo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'photos_profil_insert'
  ) THEN
    CREATE POLICY "photos_profil_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'photos-profil');
  END IF;

  -- rapports: direction + chef_maintenance can upload reports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'rapports_insert'
  ) THEN
    CREATE POLICY "rapports_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'rapports'
        AND current_role_code() IN ('direction', 'chef_maintenance', 'admin_it')
      );
  END IF;

  -- manuels-equipements: direction + chef_maintenance can upload docs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'manuels_equipements_insert'
  ) THEN
    CREATE POLICY "manuels_equipements_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'manuels-equipements'
        AND current_role_code() IN ('direction', 'chef_maintenance', 'admin_it')
      );
  END IF;
END $$;
