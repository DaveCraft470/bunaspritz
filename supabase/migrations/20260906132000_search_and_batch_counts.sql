-- Trigram indexes so the existing ilike search (lib/social.ts's
-- searchProfiles) scales past a full sequential scan, plus a real event
-- search RPC — event search doesn't exist at all today, only user search.
create extension if not exists pg_trgm;

create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index profiles_name_trgm_idx on public.profiles using gin (name gin_trgm_ops);
create index events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create index events_genre_trgm_idx on public.events using gin (genre gin_trgm_ops);

create or replace function public.search_events(
  p_query text default null,
  p_genre text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 20,
  p_cursor timestamptz default null
)
returns setof public.events
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.events e
  where e.status = 'active'
    and (p_query is null or e.title ilike '%' || p_query || '%' or e.genre ilike '%' || p_query || '%')
    and (p_genre is null or e.genre = p_genre)
    and (p_min_price is null or e.entry_fee_ron is null or e.entry_fee_ron >= p_min_price)
    and (p_max_price is null or e.entry_fee_ron is null or e.entry_fee_ron <= p_max_price)
    and (p_from is null or e.starts_at is null or e.starts_at >= p_from)
    and (p_to is null or e.starts_at is null or e.starts_at <= p_to)
    and (p_cursor is null or e.created_at < p_cursor)
  order by e.created_at desc
  limit least(coalesce(p_limit, 20), 100);
$$;

grant execute on function public.search_events(text, text, numeric, numeric, timestamptz, timestamptz, integer, timestamptz) to authenticated;

-- Replaces the per-event getEventAttendeeCount() loop in
-- organizer-dashboard.tsx (one RPC round trip per hosted event) with a
-- single batched call, same idea as getFollowStatuses/getFriendshipStatuses
-- already did for search.tsx.
create or replace function public.event_attendee_counts(p_event_ids uuid[])
returns table (event_id uuid, attendee_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select ea.event_id, count(*)::integer
  from public.event_attendees ea
  where ea.event_id = any (p_event_ids)
  group by ea.event_id;
$$;

grant execute on function public.event_attendee_counts(uuid[]) to authenticated;
