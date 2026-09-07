-- Trending: ranks events by how many people joined recently (a growth
-- signal), not by total attendee count — a big long-running event with a
-- high headline count isn't "trending" if nobody new is joining it right
-- now. Same privacy-safe idiom as event_attendee_count
-- (20260903100000_review_gate_and_attendee_count.sql): security definer so
-- it can see every event_attendees row regardless of hide_activity_from,
-- but only ever returns an event id + a count, never identities.
create or replace function public.trending_events(p_hours integer default 48, p_limit integer default 10)
returns table (event_id uuid, recent_joins integer)
language sql
security definer
set search_path = public
stable
as $$
  select ea.event_id, count(*)::integer as recent_joins
  from public.event_attendees ea
  join public.events e on e.id = ea.event_id
  where ea.joined_at >= now() - (p_hours || ' hours')::interval
    and (e.starts_at is null or e.starts_at > now())
  group by ea.event_id
  having count(*) >= 2
  order by recent_joins desc, ea.event_id
  limit p_limit;
$$;

grant execute on function public.trending_events(integer, integer) to authenticated;
