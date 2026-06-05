
-- ============================================================================
-- SÉCURISATION STORAGE ALBA (v2 avec bonne jointure auth_user_id / roles.code)
-- ============================================================================

-- 1. Buckets en privé + limites de taille + types MIME
update storage.buckets set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id in ('alba-controles', 'alba-equipements', 'alba-incidents', 'alba-interventions');

update storage.buckets set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
where id = 'alba-signatures';

update storage.buckets set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
where id = 'alba-documents';

-- 2. Supprimer les anciennes policies si elles existent
drop policy if exists "alba_authenticated_read" on storage.objects;
drop policy if exists "alba_authenticated_write" on storage.objects;
drop policy if exists "alba_authenticated_update" on storage.objects;
drop policy if exists "alba_authenticated_delete" on storage.objects;
drop policy if exists "alba_privileged_delete" on storage.objects;

-- 3. SELECT : tout utilisateur ALBA authentifié et actif peut lire
create policy "alba_authenticated_read"
on storage.objects for select
to authenticated
using (
  bucket_id in ('alba-controles', 'alba-documents', 'alba-equipements', 'alba-incidents', 'alba-interventions', 'alba-signatures')
  and exists (
    select 1 from public.utilisateurs u
    where u.auth_user_id = auth.uid() and u.actif = true
  )
);

-- 4. INSERT : authenticated actif peut uploader
create policy "alba_authenticated_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('alba-controles', 'alba-documents', 'alba-equipements', 'alba-incidents', 'alba-interventions', 'alba-signatures')
  and owner = auth.uid()
  and exists (
    select 1 from public.utilisateurs u
    where u.auth_user_id = auth.uid() and u.actif = true
  )
);

-- 5. UPDATE : seul le propriétaire du fichier peut le modifier
create policy "alba_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id in ('alba-controles', 'alba-documents', 'alba-equipements', 'alba-incidents', 'alba-interventions', 'alba-signatures')
  and owner = auth.uid()
);

-- 6. DELETE : uniquement direction et chef_maintenance (traçabilité Lean)
create policy "alba_privileged_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('alba-controles', 'alba-documents', 'alba-equipements', 'alba-incidents', 'alba-interventions', 'alba-signatures')
  and exists (
    select 1 from public.utilisateurs u
    join public.roles r on r.id = u.role_id
    where u.auth_user_id = auth.uid()
    and u.actif = true
    and r.code in ('direction', 'chef_maintenance')
  )
);
;
