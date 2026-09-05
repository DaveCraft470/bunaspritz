-- §21/22 asks that "exact location only after proximity/access" be
-- enforced server-side, not just UI. IMPORTANT SCOPE NOTE: there is no
-- existing "approximate vs exact" concept anywhere in this app today —
-- every event pin currently shows its real lat/lng to any signed-in user,
-- and the whole home screen is built around browsing exact live-map pins.
-- Silently fuzzing coordinates by default would change that core loop
-- without a design for "how do you decide whether to go" pre-join. So this
-- migration ships the capability (a view exact-location visibility can be
-- built on) WITHOUT rewiring fetchEvents()/the map to use it — that
-- product decision is left to a human, not guessed here. See the
-- accompanying report for the explicit callout.

create or replace function public.can_see_exact_event_location(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.events e where e.id = p_event_id and e.host_id = auth.uid()
  ) or exists (
    select 1 from public.event_attendees ea where ea.event_id = p_event_id and ea.user_id = auth.uid()
  );
$$;

grant execute on function public.can_see_exact_event_location(uuid) to authenticated;

-- ~0.01 degrees is roughly 1km at Romania's latitude — coarse enough to not
-- reveal an address, precise enough to still place a neighborhood on a map.
create or replace function public.public_events()
returns table (
  id uuid, host_id uuid, title text, detail text, emoji text, color text,
  lng double precision, lat double precision, genre text, starts_at timestamptz,
  entry_fee_ron numeric, drinks_price_ron numeric, max_participants integer,
  location_is_rented boolean, status text, created_at timestamptz, exact_location boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id, e.host_id, e.title, e.detail, e.emoji, e.color,
    case when public.can_see_exact_event_location(e.id) then e.lng else round(e.lng::numeric, 2)::double precision end,
    case when public.can_see_exact_event_location(e.id) then e.lat else round(e.lat::numeric, 2)::double precision end,
    e.genre, e.starts_at, e.entry_fee_ron, e.drinks_price_ron, e.max_participants,
    e.location_is_rented, e.status, e.created_at,
    public.can_see_exact_event_location(e.id)
  from public.events e
  where e.status = 'active';
$$;

grant execute on function public.public_events() to authenticated;
