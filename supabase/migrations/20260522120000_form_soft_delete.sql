-- Soft-delete drafts: deleted_at marks trash; purge after 1 day (pg_cron).

alter table public.forms
  add column if not exists deleted_at timestamptz;

comment on column public.forms.deleted_at is
  'When set, the draft is in trash. Purged permanently after 1 day.';

create index if not exists forms_deleted_at_idx
  on public.forms (deleted_at)
  where deleted_at is not null;

create index if not exists forms_trash_purge_idx
  on public.forms (deleted_at)
  where deleted_at is not null;

-- Only draft forms may enter trash; restore only within retention window.
create or replace function public.forms_guard_soft_delete()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if old.status <> 'draft' then
      raise exception 'Only draft forms can be moved to trash';
    end if;
  end if;

  if new.deleted_at is null and old.deleted_at is not null then
    if old.deleted_at < now() - interval '1 day' then
      raise exception 'Trash retention expired; this form can no longer be restored';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists forms_guard_soft_delete on public.forms;
create trigger forms_guard_soft_delete
  before update on public.forms
  for each row
  execute function public.forms_guard_soft_delete();

-- Permanently remove expired trash rows and their sketch objects.
create or replace function public.purge_expired_deleted_forms()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  r record;
  paths text[];
  purged integer := 0;
begin
  for r in
    select id, sketch_path, sketch_paths
    from public.forms
    where deleted_at is not null
      and deleted_at < now() - interval '1 day'
  loop
    paths := array[]::text[];
    if r.sketch_path is not null then
      paths := paths || r.sketch_path;
    end if;
    if r.sketch_paths is not null then
      paths := paths || r.sketch_paths;
    end if;

    if paths is not null and cardinality(paths) > 0 then
      delete from storage.objects o
      where o.bucket_id = 'sketches'
        and o.name in (
          select distinct p
          from unnest(paths) as p
          where p is not null and p <> ''
        );
    end if;

    delete from public.forms where id = r.id;
    purged := purged + 1;
  end loop;

  return purged;
end;
$$;

revoke all on function public.purge_expired_deleted_forms() from public;
grant execute on function public.purge_expired_deleted_forms() to postgres;

-- Hourly purge (requires pg_cron enabled on the Supabase project).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-expired-deleted-forms');

    perform cron.schedule(
      'purge-expired-deleted-forms',
      '0 * * * *',
      $$select public.purge_expired_deleted_forms();$$
    );
  end if;
end;
$cron$;
