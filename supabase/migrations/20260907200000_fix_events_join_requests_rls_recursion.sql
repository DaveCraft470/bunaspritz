-- Fixes a live "infinite recursion detected in policy for relation events"
-- error (Postgres 42P17) discovered by actually exercising a fresh signed-up
-- account against production, not by code review. Root cause: events'
-- SELECT policy (from 20260906151000_add_event_privacy_and_join_requests.sql)
-- checks visibility via a correlated subquery on event_join_requests, whose
-- own "host sees join requests for their own events" policy checks back via
-- a correlated subquery on events — each table's RLS evaluation requires
-- fully evaluating the other's RLS, which recurses forever. This predates
-- today's session entirely and is unrelated to any of its migrations; it
-- means any query path that couldn't short-circuit past the private-event
-- branch has been failing since 20260906151000 first shipped.
--
-- Separately (and found live, but NOT present in git's copy of that
-- migration — this was edited out-of-band against production at some
-- point): the deployed events policy read `r.event_id = r.id` instead of
-- `r.event_id = id`, comparing a row to itself instead of correlating with
-- the outer table. That typo alone would have hidden events from anyone
-- with an open join request, independent of the recursion.
--
-- Fix: security-definer helpers break the cycle the same way is_admin() and
-- are_friends() already do elsewhere in this schema — their internal
-- queries run as the function owner, which bypasses RLS entirely, so
-- calling them from a policy can't recurse back into the same policy.
create or replace function public.is_event_host(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.events where id = p_event_id and host_id = auth.uid());
$$;

grant execute on function public.is_event_host(uuid) to authenticated;

create or replace function public.has_join_request_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.event_join_requests where event_id = p_event_id and user_id = auth.uid());
$$;

grant execute on function public.has_join_request_for_event(uuid) to authenticated;

drop policy "host sees join requests for their own events" on public.event_join_requests;
create policy "host sees join requests for their own events"
  on public.event_join_requests for select
  using (public.is_event_host(event_id));

drop policy "public events are readable by any signed-in user, private ones by the involved" on public.events;
create policy "public events are readable by any signed-in user, private ones by the involved"
  on public.events for select
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or exists (select 1 from public.event_attendees ea where ea.event_id = id and ea.user_id = auth.uid())
    or public.has_join_request_for_event(id)
  );
