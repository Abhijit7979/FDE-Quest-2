-- Row Level Security policies for sketch-to-form
--
-- Strategy
--   profiles         → user can read/update only their own row (insert handled by signup trigger)
--   forms            → full CRUD for owner; public reads happen via the public_forms view (anon select on forms is denied)
--   form_responses   → anonymous INSERT allowed only when parent form is published;
--                      SELECT/DELETE restricted to the form owner
--   generation_jobs  → full CRUD for owner only

-- ────────────────────────────────────────────────────────────
-- Enable RLS
-- ────────────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.forms           enable row level security;
alter table public.form_responses  enable row level security;
alter table public.generation_jobs enable row level security;

-- ────────────────────────────────────────────────────────────
-- profiles
-- ────────────────────────────────────────────────────────────
create policy "profiles: owner can select"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles: owner can update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- INSERTs come from the on_auth_user_created trigger (security definer).

-- ────────────────────────────────────────────────────────────
-- forms (owner-only)
-- ────────────────────────────────────────────────────────────
create policy "forms: owner can select"
on public.forms
for select
to authenticated
using (owner_id = auth.uid());

create policy "forms: owner can insert"
on public.forms
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "forms: owner can update"
on public.forms
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "forms: owner can delete"
on public.forms
for delete
to authenticated
using (owner_id = auth.uid());

-- Public respondent reads go through the public_forms view; grant select on it.
grant select on public.public_forms to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- form_responses
-- ────────────────────────────────────────────────────────────
-- Anonymous (or authenticated) respondents can submit to any *published* form.
create policy "form_responses: anyone can submit to published form"
on public.form_responses
for insert
to anon, authenticated
with check (
    exists (
        select 1
        from public.forms f
        where f.id = form_responses.form_id
          and f.status = 'published'
    )
);

-- Only the form owner can read responses.
create policy "form_responses: owner can select"
on public.form_responses
for select
to authenticated
using (
    exists (
        select 1
        from public.forms f
        where f.id = form_responses.form_id
          and f.owner_id = auth.uid()
    )
);

-- Only the form owner can delete responses.
create policy "form_responses: owner can delete"
on public.form_responses
for delete
to authenticated
using (
    exists (
        select 1
        from public.forms f
        where f.id = form_responses.form_id
          and f.owner_id = auth.uid()
    )
);

-- ────────────────────────────────────────────────────────────
-- generation_jobs (owner-only)
-- ────────────────────────────────────────────────────────────
create policy "generation_jobs: owner can select"
on public.generation_jobs
for select
to authenticated
using (owner_id = auth.uid());

create policy "generation_jobs: owner can insert"
on public.generation_jobs
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "generation_jobs: owner can update"
on public.generation_jobs
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "generation_jobs: owner can delete"
on public.generation_jobs
for delete
to authenticated
using (owner_id = auth.uid());
