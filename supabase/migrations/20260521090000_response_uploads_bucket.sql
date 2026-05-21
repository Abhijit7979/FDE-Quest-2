-- Private 'response-uploads' bucket for files submitted by respondents
-- through `file_upload` form fields (images + PDFs).
--
-- Layout: {form_id}/{uuid}.{ext}
--   The first path segment is the form id. Respondents (anon) may upload
--   only into a *published* form's folder; the form owner may read/delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'response-uploads',
    'response-uploads',
    false,
    10 * 1024 * 1024,                       -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ────────────────────────────────────────────────────────────
-- Respondents (anon or authenticated) may upload into a published
-- form's folder. `public_forms` is a security-definer view of published
-- forms, so the EXISTS check works for the anon role without exposing
-- the underlying `forms` table (whose RLS denies anon entirely).
-- ────────────────────────────────────────────────────────────
create policy "response-uploads: respondent can upload to published form"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'response-uploads'
    and exists (
        select 1
        from public.public_forms pf
        where pf.id::text = (storage.foldername(name))[1]
    )
);

-- The form owner may read submitted files (e.g. to mint signed download URLs).
create policy "response-uploads: owner can read"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'response-uploads'
    and exists (
        select 1
        from public.forms f
        where f.id::text = (storage.foldername(name))[1]
          and f.owner_id = auth.uid()
    )
);

-- The form owner may delete submitted files.
create policy "response-uploads: owner can delete"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'response-uploads'
    and exists (
        select 1
        from public.forms f
        where f.id::text = (storage.foldername(name))[1]
          and f.owner_id = auth.uid()
    )
);

-- Backend reads (FastAPI) use the service role key, which bypasses RLS,
-- so no separate policy is needed there.
