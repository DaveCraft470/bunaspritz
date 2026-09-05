-- Two fixes from a follow-up audit:

-- 1. can_review's 6-hour-since-joined gate assumed events have no schedule
-- ("live-now map pins"), which the event-creator overhaul (same day)
-- invalidated by adding real starts_at scheduling up to 10 days out. Someone
-- could join a spritz scheduled for next week and review a co-attendee 6
-- hours later, before it happened. Now: if the event has a starts_at,
-- require 2 hours past that (assume a spritz runs a couple hours) instead
-- of just time-since-joined; undated/legacy events keep the original
-- joined_at-based gate.
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
    join public.events e on e.id = reviewer_row.event_id
    where reviewer_row.event_id = p_event_id
      and reviewer_row.user_id = p_reviewer_id
      and now() > coalesce(
        e.starts_at + interval '2 hours',
        greatest(reviewer_row.joined_at, subject_row.joined_at) + interval '6 hours'
      )
  );
$$;

-- 2. The client's "is this event full" check used fetchAttendees(), which
-- reads visible_event_attendees (filtered by hide_activity_from) — so a
-- viewer could see the join button as tappable on an event that's actually
-- full, if any attendee hid their activity from them. The server-side
-- event_is_full() check already blocks the insert correctly either way,
-- but the UI was misleading. This returns just a count, never identities,
-- so it's safe to read regardless of anyone's hide_activity_from setting.
create or replace function public.event_attendee_count(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.event_attendees where event_id = p_event_id;
$$;

grant execute on function public.event_attendee_count(uuid) to authenticated;
