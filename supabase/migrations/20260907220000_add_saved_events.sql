-- Saved Events: users can bookmark an event to revisit later without having
-- to re-find it in Discover (see app/saved-events.tsx and lib/savedEvents.ts).
create table public.saved_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index saved_events_user_idx on public.saved_events (user_id, created_at desc);

alter table public.saved_events enable row level security;

create policy "see only your own saved events"
  on public.saved_events for select
  using (user_id = auth.uid());

create policy "save events as yourself"
  on public.saved_events for insert
  with check (user_id = auth.uid());

create policy "unsave your own saved events"
  on public.saved_events for delete
  using (user_id = auth.uid());
