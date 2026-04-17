/*
  # Remove overly broad SELECT policies on storage buckets

  1. Security Fix
    - Drop SELECT policies on all 6 alba-* buckets
    - Buckets are public, so getPublicUrl() works without SELECT policies
    - SELECT policies were allowing authenticated users to LIST all files
    - Only INSERT (upload) policies are kept
*/

DROP POLICY IF EXISTS "read_alba_controles" ON storage.objects;
DROP POLICY IF EXISTS "read_alba_documents" ON storage.objects;
DROP POLICY IF EXISTS "read_alba_equipements" ON storage.objects;
DROP POLICY IF EXISTS "read_alba_incidents" ON storage.objects;
DROP POLICY IF EXISTS "read_alba_interventions" ON storage.objects;
DROP POLICY IF EXISTS "read_alba_signatures" ON storage.objects;
