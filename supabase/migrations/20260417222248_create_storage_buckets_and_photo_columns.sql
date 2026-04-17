/*
  # Storage buckets and photo columns for ALBA

  1. New Storage Buckets
    - `alba-controles` - Photos de preuves KO sur controles
    - `alba-interventions` - Photos avant/apres interventions
    - `alba-incidents` - Photos signalements incidents
    - `alba-signatures` - Signatures tactiles PNG
    - `alba-documents` - Certifications PDF
    - `alba-equipements` - Photos equipements

  2. Storage Security (RLS)
    - INSERT pour authenticated (upload)
    - SELECT pour authenticated (lecture)
    - Pas de DELETE (conformite DGCCRF)

  3. New Columns
    - `equipements.photo_url` (text) - Photo principale equipement
    - `plaintes_clients.photo_url` (text) - Photo plainte client
    - `notes_chantier.photo_url` (text) - Photo note chantier
*/

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('alba-controles', 'alba-controles', true),
  ('alba-interventions', 'alba-interventions', true),
  ('alba-incidents', 'alba-incidents', true),
  ('alba-signatures', 'alba-signatures', true),
  ('alba-documents', 'alba-documents', true),
  ('alba-equipements', 'alba-equipements', true)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  bucket_names text[] := ARRAY['alba-controles', 'alba-interventions', 'alba-incidents', 'alba-signatures', 'alba-documents', 'alba-equipements'];
  b text;
BEGIN
  FOREACH b IN ARRAY bucket_names LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "upload_%s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)',
        replace(b, '-', '_'), b
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY "read_%s" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)',
        replace(b, '-', '_'), b
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipements' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE equipements ADD COLUMN photo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaintes_clients' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE plaintes_clients ADD COLUMN photo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes_chantier' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE notes_chantier ADD COLUMN photo_url text;
  END IF;
END $$;
