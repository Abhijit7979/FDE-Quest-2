-- Private 'sketches' bucket + RLS policies on storage.objects
--
-- Layout: objects are uploaded to {auth.uid()}/{form_id_or_filename}.{ext}
-- The first path segment must equal the uploader's auth.uid(); enforced via RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'sketches',
    'sketches',
    false,
    10 * 1024 * 1024,                       -- 10 MB (matches PRD C-1)
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ────────────────────────────────────────────────────────────
-- Per-user folder policies on storage.objects (RLS is already
-- enabled on storage.objects by default in Supabase).
-- ────────────────────────────────────────────────────────────

create policy "sketches: user can upload to own folder"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'sketches'
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "sketches: user can read own files"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'sketches'
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "sketches: user can update own files"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'sketches'
    and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
    bucket_id = 'sketches'
    and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "sketches: user can delete own files"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'sketches'
    and (storage.foldername(name))[1] = auth.uid()::text
);

-- Backend reads (FastAPI) use the service role key, which bypasses RLS,
-- so no separate policy is needed for the AI pipeline.
