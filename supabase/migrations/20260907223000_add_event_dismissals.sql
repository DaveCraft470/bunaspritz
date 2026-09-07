-- Not Interested / Undo Skip: a user can hide an event from Discover, and
-- undo that within the session (see lib/eventDismissals.ts). Deleting the
-- row is the undo — same "delete = revert" idiom as event_join_requests'
-- withdraw-while-pending policy.
create table public.event_dismissals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index event_dismissals_user_idx on public.event_dismissals (user_id);

alter table public.event_dismissals enable row level security;

create policy "see only your own dismissed events"
  on public.event_dismissals for select
  using (user_id = auth.uid());

create policy "dismiss events as yourself"
  on public.event_dismissals for insert
  with check (user_id = auth.uid());

create policy "undo your own dismissal"
  on public.event_dismissals for delete
  using (user_id = auth.uid());
