-- Recently Viewed: tracks the last events a user opened an event detail page
-- for (see lib/recentActivity.ts). All writes go through record_event_view()
-- below instead of a client insert policy, so the per-user list can be
-- trimmed to a fixed size server-side in the same transaction as the upsert
-- — the client never has to reason about "did this exceed the cap".
create table public.recently_viewed_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index recently_viewed_events_user_idx on public.recently_viewed_events (user_id, viewed_at desc);

alter table public.recently_viewed_events enable row level security;

create policy "see only your own recently viewed events"
  on public.recently_viewed_events for select
  using (user_id = auth.uid());

-- Same "definer function owns the writes" idiom as check_in_to_event
-- (20260907130000_add_event_checkins.sql): upserts the view timestamp, then
-- prunes anything past the 20 most recent rows for that user.
create or replace function public.record_event_view(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recently_viewed_events (user_id, event_id, viewed_at)
  values (auth.uid(), p_event_id, now())
  on conflict (user_id, event_id) do update set viewed_at = excluded.viewed_at;

  delete from public.recently_viewed_events
  where user_id = auth.uid()
    and event_id not in (
      select event_id from public.recently_viewed_events
      where user_id = auth.uid()
      order by viewed_at desc
      limit 20
    );
end;
$$;

grant execute on function public.record_event_view(uuid) to authenticated;
