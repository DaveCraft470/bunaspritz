-- "De acordat" review queue: reviewable_events(subject_id) already answers
-- "which events can I review THIS ONE person for", but the queue screen
-- needs the reverse — every (event, co-attendee) pair across ALL of the
-- caller's events they can currently review, in one call, so the client
-- isn't looping reviewable_events() over every person they've ever attended
-- an event with.

-- A dismissed pair should stop showing up in the queue without counting as
-- reviewed (no rating gets recorded) and without permanently blocking a
-- future review of the same person from a *different* shared event.
create table public.review_dismissals (
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (reviewer_id, event_id, subject_id)
);

alter table public.review_dismissals enable row level security;

create policy "see your own dismissals"
  on public.review_dismissals for select
  using (reviewer_id = auth.uid());

create policy "dismiss as yourself"
  on public.review_dismissals for insert
  with check (reviewer_id = auth.uid());

-- Every (event, co-attendee) pair the caller can currently review, across
-- every event they've attended — same can_review() gate as reviewable_events,
-- just not scoped to one subject. security definer for the same reason as
-- reviewable_events: event_attendees' own RLS would otherwise hide every
-- other attendee's row from the caller.
create or replace function public.reviewable_pending_for_me()
returns table (
  event_id uuid,
  event_title text,
  subject_id uuid,
  subject_name text,
  subject_username text,
  subject_avatar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct
    e.id as event_id,
    e.title as event_title,
    other.user_id as subject_id,
    p.name as subject_name,
    p.username as subject_username,
    p.avatar_url as subject_avatar_url
  from public.event_attendees mine
  join public.event_attendees other
    on other.event_id = mine.event_id and other.user_id <> mine.user_id
  join public.events e on e.id = mine.event_id
  join public.profiles p on p.id = other.user_id
  where mine.user_id = auth.uid()
    and public.can_review(mine.event_id, auth.uid(), other.user_id)
    and not exists (
      select 1 from public.reviews r
      where r.event_id = mine.event_id and r.reviewer_id = auth.uid() and r.subject_id = other.user_id
    )
    and not exists (
      select 1 from public.review_dismissals d
      where d.event_id = mine.event_id and d.reviewer_id = auth.uid() and d.subject_id = other.user_id
    )
  order by e.title;
$$;

grant execute on function public.reviewable_pending_for_me() to authenticated;
