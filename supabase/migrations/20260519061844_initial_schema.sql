-- Initial schema for sketch-to-form
-- Tables: profiles, forms, form_responses, generation_jobs
-- Plus enums, trigger to maintain updated_at, and auto-profile creation on signup

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────
create type public.form_status as enum ('draft', 'published', 'archived');
create type public.job_status  as enum ('pending', 'processing', 'completed', 'failed');

-- ────────────────────────────────────────────────────────────
-- profiles  (1:1 with auth.users)
-- ────────────────────────────────────────────────────────────
create table public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    display_name text,
    created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Application-level profile data, 1:1 with auth.users.';

-- ────────────────────────────────────────────────────────────
-- forms
-- ────────────────────────────────────────────────────────────
create table public.forms (
    id           uuid primary key default gen_random_uuid(),
    owner_id     uuid not null references public.profiles(id) on delete cascade,
    title        text not null default 'Untitled form',
    description  text,
    status       public.form_status not null default 'draft',
    public_slug  text unique,
    definition   jsonb not null default jsonb_build_object('version', 1, 'fields', '[]'::jsonb),
    sketch_path  text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    published_at timestamptz,
    constraint forms_published_requires_slug
        check (status <> 'published' or public_slug is not null)
);

create index forms_owner_id_idx       on public.forms (owner_id);
create index forms_status_idx         on public.forms (status);
create index forms_public_slug_idx    on public.forms (public_slug) where public_slug is not null;
create index forms_owner_updated_idx  on public.forms (owner_id, updated_at desc);

-- ────────────────────────────────────────────────────────────
-- form_responses
-- ────────────────────────────────────────────────────────────
create table public.form_responses (
    id              uuid primary key default gen_random_uuid(),
    form_id         uuid not null references public.forms(id) on delete cascade,
    answers         jsonb not null default '{}'::jsonb,
    submitted_at    timestamptz not null default now(),
    respondent_meta jsonb not null default '{}'::jsonb
);

create index form_responses_form_id_idx        on public.form_responses (form_id);
create index form_responses_form_submitted_idx on public.form_responses (form_id, submitted_at desc);

-- ────────────────────────────────────────────────────────────
-- generation_jobs
-- ────────────────────────────────────────────────────────────
create table public.generation_jobs (
    id           uuid primary key default gen_random_uuid(),
    form_id      uuid references public.forms(id) on delete cascade,
    owner_id     uuid not null references public.profiles(id) on delete cascade,
    status       public.job_status not null default 'pending',
    error        text,
    created_at   timestamptz not null default now(),
    completed_at timestamptz
);

create index generation_jobs_owner_id_idx on public.generation_jobs (owner_id);
create index generation_jobs_form_id_idx  on public.generation_jobs (form_id);
create index generation_jobs_status_idx   on public.generation_jobs (status);

-- ────────────────────────────────────────────────────────────
-- updated_at maintenance trigger
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger forms_set_updated_at
before update on public.forms
for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Auto-create a profile row whenever a new auth user signs up
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', null)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- Public view for respondent access (used by RLS strategy)
-- Only exposes published forms and only safe columns.
-- ────────────────────────────────────────────────────────────
create view public.public_forms
with (security_invoker = true)
as
select
    f.id,
    f.public_slug,
    f.title,
    f.description,
    f.definition
from public.forms f
where f.status = 'published'
  and f.public_slug is not null;

comment on view public.public_forms is 'Anonymous-readable projection of published forms (no owner_id, no sketch_path).';
