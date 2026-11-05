-- =====================================================================
-- Private storage bucket for all research files.
--
-- * public = false  → no unauthenticated "public URL" access. Files can be
--   read only with the admin's JWT or a short-lived signed URL that the
--   admin's browser requests after login.
-- * 50 MB per-file limit = the Supabase Free-plan global maximum. Raise it
--   here AND in VITE_MAX_UPLOAD_MB only on a paid plan.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-files',
  'research-files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png','image/jpeg','image/webp','image/svg+xml','image/gif',
    'video/mp4','video/webm',
    'audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/flac','audio/x-flac',
    'application/json','text/csv','text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "research files: admin select"
  on storage.objects for select to authenticated
  using (bucket_id = 'research-files' and public.is_admin());

create policy "research files: admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'research-files' and public.is_admin());

create policy "research files: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'research-files' and public.is_admin())
  with check (bucket_id = 'research-files' and public.is_admin());

create policy "research files: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'research-files' and public.is_admin());
