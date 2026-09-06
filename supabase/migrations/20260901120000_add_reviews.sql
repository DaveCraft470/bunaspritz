-- Peer reviews, gated to people you actually shared a spritz with — and
-- only once that spritz has had time to happen, not the instant you both
-- join the same event.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (event_id, reviewer_id, subject_id),
  check (reviewer_id <> subject_id)
);

create index reviews_subject_idx on public.reviews (subject_id);

alter table public.reviews enable row level security;

create policy "reviews are readable by any signed-in user"
  on public.reviews for select
  using (auth.role() = 'authenticated');

create policy "retract only your own review"
  on public.reviews for delete
  using (reviewer_id = auth.uid());

revoke update on public.reviews from authenticated;

-- event_attendees' own RLS ("see only your own attendance row directly")
-- means a plain EXISTS subquery on the *subject's* row would always read as
-- empty for the reviewer, since RLS applies to tables referenced inside a
-- policy check too. security definer (postgres owner) bypasses that while
-- auth.uid() below still resolves to the real caller — same idiom as
-- handle_new_user and visible_event_attendees.
--
-- Events here have no scheduled end time (they're live-now map pins, not
-- calendar entries), so "co-attended" alone isn't a strong enough gate —
-- someone could join an event a friend is already at and review them
-- seconds later. Requiring both joined_at timestamps to be a few hours old
-- approximates "the spritz actually happened" without a schema redesign.
create or replace function public.can_review(p_event_id uuid, p_reviewer_id uuid, p_subject_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.event_attendees reviewer_row
    join public.event_attendees subject_row
      on subject_row.event_id = reviewer_row.event_id
     and subject_row.user_id = p_subject_id
    where reviewer_row.event_id = p_event_id
      and reviewer_row.user_id = p_reviewer_id
      and greatest(reviewer_row.joined_at, subject_row.joined_at) < now() - interval '6 hours'
  );
$$;

grant execute on function public.can_review(uuid, uuid, uuid) to authenticated;

create policy "review only eligible co-attendees, as yourself"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and public.can_review(event_id, reviewer_id, subject_id)
  );

-- Lists the events (if any) the caller can currently leave subject_id a
-- review for — shared spritz, past the time gate, not already reviewed.
-- Drives the "Lasă un review" affordance on a profile without the client
-- needing to see subject_id's raw event_attendees rows (RLS blocks that).
create or replace function public.reviewable_events(p_subject_id uuid)
returns table (event_id uuid, title text)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.title
  from public.event_attendees ea
  join public.events e on e.id = ea.event_id
  where ea.user_id = auth.uid()
    and public.can_review(ea.event_id, auth.uid(), p_subject_id)
    and not exists (
      select 1 from public.reviews r
      where r.event_id = ea.event_id and r.reviewer_id = auth.uid() and r.subject_id = p_subject_id
    )
  order by e.created_at desc;
$$;

grant execute on function public.reviewable_events(uuid) to authenticated;
