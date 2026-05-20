-- Anonymous respondents read published forms via public_forms.
-- security_invoker = true caused RLS on forms to block anon (no select policy on forms).
-- Recreate as security definer so the view owner can project published rows safely.

drop view if exists public.public_forms;

create view public.public_forms
with (security_invoker = false)
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

grant select on public.public_forms to anon, authenticated;
