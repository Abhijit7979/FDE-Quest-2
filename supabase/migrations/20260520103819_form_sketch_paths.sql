-- Store every sketch image path used for a form (multi-page / multi-photo create flow).
-- sketch_path remains the primary thumbnail (first image) for existing UI.
alter table public.forms
  add column if not exists sketch_paths text[];

comment on column public.forms.sketch_paths is
  'All sketch storage paths for this form; sketch_path is the primary (first) path.';
