-- Add tour completion state to profiles
--
-- A nullable timestamptz on profiles tracks whether a user has finished (or
-- skipped) the in-app product tour. The frontend auto-triggers the tour for
-- any signed-in user whose tour_completed_at is NULL, and exposes a manual
-- "Show tour" button in the header to replay it at any time.
--
-- To avoid surprising existing accounts with an unexpected tour on next login,
-- backfill all current rows with now(). Only profiles created after this
-- migration (i.e. genuinely new sign-ups) will see the tour automatically.

alter table public.profiles
    add column if not exists tour_completed_at timestamptz;

update public.profiles
   set tour_completed_at = now()
 where tour_completed_at is null;

comment on column public.profiles.tour_completed_at is
    'When the user finished or skipped the in-app product tour. NULL means the tour has not been completed and will auto-trigger on next session.';
