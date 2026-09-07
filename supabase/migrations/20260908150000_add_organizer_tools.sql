-- Sprint 8 — organizer tools: Event Templates, Scheduled Publishing,
-- Organizer Reputation Score, Advanced/Check-in Analytics (+ Save→Join
-- conversion). Duplicate Event and Recurring Events need no schema change —
-- both are just createEvent() called again client-side with adjusted
-- fields/dates, same insert path and RLS as any other event creation.

-- ======================================================== event_templates ==
create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  title text not null,
  detail text not null default '',
  emoji text not null default '🍹',
  color text not null default '#1FD460',
  genre text not null default '',
  entry_fee_ron numeric,
  drinks_price_ron numeric,
  max_participants integer,
  visibility text not null default 'public',
  approval_mode text not null default 'instant',
  created_at timestamptz not null default now()
);

alter table public.event_templates enable row level security;

create policy "see only your own event templates"
  on public.event_templates for select
  using (host_id = auth.uid());

create policy "save your own event templates"
  on public.event_templates for insert
  with check (host_id = auth.uid());

create policy "delete your own event templates"
  on public.event_templates for delete
  using (host_id = auth.uid());

-- ==================================================== scheduled publishing ==
-- A host can create an event now but hold it back from Discover/the map
-- until publish_at — null means "publish immediately" (the existing
-- behavior, so every pre-existing event keeps working unchanged).
--
-- The events SELECT policy actually live today is
-- "public events are readable by any signed-in user, private ones by the
-- involved" (20260907200000_fix_events_join_requests_rls_recursion.sql) —
-- NOT "events are readable by any signed-in user" from the init migration,
-- which that later migration already replaced. This adds the publish_at
-- gate on top of its existing public/private/attendee/join-request logic
-- rather than reintroducing the simpler policy it superseded, which would
-- have silently broken private-event visibility.
alter table public.events add column publish_at timestamptz;

drop policy "public events are readable by any signed-in user, private ones by the involved" on public.events;
create policy "public events are readable by any signed-in user, private ones by the involved"
  on public.events for select
  using (
    (publish_at is null or publish_at <= now() or host_id = auth.uid())
    and (
      visibility = 'public'
      or host_id = auth.uid()
      or exists (select 1 from public.event_attendees ea where ea.event_id = id and ea.user_id = auth.uid())
      or public.has_join_request_for_event(id)
    )
  );

-- ================================================ organizer reputation score ==
-- A single 0-100 score blending: review quality (as reviewed subject across
-- their own hosted events' attendees), hosting volume, and how often people
-- who join actually show up (checked_in / joined) — capped/weighted so no
-- single factor dominates. Security definer since it reads other users'
-- event_attendees rows in aggregate (counts only, same privacy model as
-- event_attendee_count).
create or replace function public.get_organizer_reputation(p_host_id uuid)
returns table (score integer, hosted_count integer, avg_rating numeric, checkin_rate numeric)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hosted_count integer;
  v_avg_rating numeric;
  v_joined_count integer;
  v_checked_in_count integer;
  v_checkin_rate numeric;
  v_score integer;
begin
  select count(*) into v_hosted_count from public.events where host_id = p_host_id;

  select avg(r.rating) into v_avg_rating
  from public.reviews r
  join public.events e on e.id = r.event_id
  where e.host_id = p_host_id;

  select count(*), count(*) filter (where ea.checked_in_at is not null)
    into v_joined_count, v_checked_in_count
    from public.event_attendees ea
    join public.events e on e.id = ea.event_id
    where e.host_id = p_host_id and ea.user_id != p_host_id;

  v_checkin_rate := case when v_joined_count > 0 then v_checked_in_count::numeric / v_joined_count else null end;

  v_score := round(
    least(40, v_hosted_count * 4)
    + coalesce(v_avg_rating, 3) / 5 * 40
    + coalesce(v_checkin_rate, 0.5) * 20
  );

  return query select v_score, v_hosted_count, round(coalesce(v_avg_rating, 0), 2), round(coalesce(v_checkin_rate, 0), 2);
end;
$$;

grant execute on function public.get_organizer_reputation(uuid) to authenticated;

-- ===================================================== event analytics =====
-- Host-only (checked inside the function, not just by RLS on the underlying
-- tables — a caller who isn't the host gets zeroed-out results rather than
-- an error, so the UI doesn't need a separate "not allowed" branch).
create or replace function public.get_event_analytics(p_event_id uuid)
returns table (view_count integer, save_count integer, join_count integer, checkin_count integer, save_to_join_count integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_host_id uuid;
begin
  select host_id into v_host_id from public.events where id = p_event_id;
  if v_host_id is null or v_host_id != auth.uid() then
    return query select 0, 0, 0, 0, 0;
    return;
  end if;

  return query
  select
    (select count(*)::integer from public.recently_viewed_events where event_id = p_event_id),
    (select count(*)::integer from public.saved_events where event_id = p_event_id),
    (select count(*)::integer from public.event_attendees where event_id = p_event_id),
    (select count(*)::integer from public.event_attendees where event_id = p_event_id and checked_in_at is not null),
    (
      select count(*)::integer from public.saved_events se
      where se.event_id = p_event_id
        and exists (select 1 from public.event_attendees ea where ea.event_id = p_event_id and ea.user_id = se.user_id)
    );
end;
$$;

grant execute on function public.get_event_analytics(uuid) to authenticated;
