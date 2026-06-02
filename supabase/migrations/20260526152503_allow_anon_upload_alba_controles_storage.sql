/*
  # Allow anonymous upload to alba-controles storage bucket

  1. Changes
    - Add INSERT policy for `anon` on `storage.objects` for bucket `alba-controles`
    - Add SELECT policy for `anon` on `storage.objects` for bucket `alba-controles`

  2. Reason
    - Staff PIN users need to upload control photos during daily opening checks
    - They don't have a Supabase auth session (they use the anon key)
    - Photos are stored in the `alba-controles` bucket

  3. Security Notes
    - Limited to `alba-controles` bucket only (no other buckets exposed)
    - Read access also granted so the photo can be viewed after upload
*/

-- Allow anon to upload photos to alba-controles bucket
CREATE POLICY "alba_controles_insert_anon_staff"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'alba-controles');

-- Allow anon to read photos from alba-controles bucket
CREATE POLICY "alba_controles_select_anon_staff"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'alba-controles');
