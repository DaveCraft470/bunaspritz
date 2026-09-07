-- Sprint 5 — "For You" recommendation engine needs a "N of your friends are
-- going" signal per event, which RLS can't answer from the client directly
-- (event_attendees only exposes your own row; visible_event_attendees is
-- per-event, not a batched cross-event aggregate). Security definer, and —
-- same privacy model as event_attendee_count/get_common_events — only ever
-- returns a count per event, never which friend.
create or replace function public.get_friend_attending_counts()
returns table (event_id uuid, friend_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select ea.event_id, count(*)::integer as friend_count
  from public.event_attendees ea
  join public.friendships f
    on (f.user_a = auth.uid() and f.user_b = ea.user_id)
    or (f.user_b = auth.uid() and f.user_a = ea.user_id)
  join public.events e on e.id = ea.event_id
  where e.starts_at is null or e.starts_at > now()
  group by ea.event_id;
$$;

grant execute on function public.get_friend_attending_counts() to authenticated;
