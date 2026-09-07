-- Joining an event (event_attendees insert) used to be the only signal behind
-- the "Evenimente" profile stat (getUserEventStats) — tapping "Hai la
-- Spritz!" counted as attendance with zero proof anyone actually showed up.
-- This adds a real confirmation step: a live camera photo taken while the
-- device's GPS is within range of the event (validated here, not just in the
-- UI, or anyone could fake it by editing the request), or — once a real
-- payment integration exists — having paid the entry fee.

alter table public.event_attendees
  add column checked_in_at timestamptz,
  add column check_in_method text,
  add column check_in_photo_path text,
  add constraint event_attendees_check_in_method_check
    check (check_in_method is null or check_in_method in ('photo', 'paid'));

-- Backfill: without this, every join that happened before this migration
-- would instantly vanish from "Evenimente" the moment this ships, since none
-- of them have a checked_in_at. Grandfather existing joins in at their
-- original joined_at; only joins from here on require a real check-in.
update public.event_attendees
set checked_in_at = joined_at
where checked_in_at is null;

-- Deliberately no UPDATE policy grant for `authenticated` here (same idiom as
-- 20260831192550_lock_verified_column.sql for profiles.verified) — a client
-- can never set checked_in_at/check_in_method directly. The 'photo' path
-- below goes through a security-definer function that validates everything
-- server-side first. The 'paid' path has no writer at all yet: there's no
-- real payment processor integrated, so nothing should be able to claim
-- "paid" today. Once one exists, its webhook (a service-role edge function,
-- exactly like supabase/functions/didit-webhook does for profiles.verified)
-- is what will set checked_in_at/check_in_method='paid', bypassing RLS.

insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', false)
on conflict (id) do nothing;

create policy "upload your own check-in photo"
  on storage.objects for insert
  with check (
    bucket_id = 'checkin-photos'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read only your own check-in photo"
  on storage.objects for select
  using (bucket_id = 'checkin-photos' and owner = auth.uid());

create policy "delete only your own check-in photo"
  on storage.objects for delete
  using (bucket_id = 'checkin-photos' and owner = auth.uid());

-- Same haversine formula as the client's distanceKm (lib/recommendations.ts),
-- ported to SQL and scaled to meters instead of km, so both sides agree on
-- what "in range" means (the client only uses its copy to enable/disable the
-- button — this is the check that actually can't be bypassed from the app).
create or replace function public.check_in_to_event(
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_lat double precision;
  v_event_lng double precision;
  v_already_checked_in boolean;
  v_distance_m double precision;
  v_max_distance_m constant double precision := 200;
begin
  select e.lat, e.lng into v_event_lat, v_event_lng
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'event not found';
  end if;

  select checked_in_at is not null into v_already_checked_in
  from public.event_attendees
  where event_id = p_event_id and user_id = auth.uid();

  if v_already_checked_in is null then
    raise exception 'not joined';
  end if;

  if v_already_checked_in then
    raise exception 'already checked in';
  end if;

  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_lat - v_event_lat) / 2), 2) +
    cos(radians(v_event_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - v_event_lng) / 2), 2)
  ));

  if v_distance_m > v_max_distance_m then
    raise exception 'too far from event location';
  end if;

  update public.event_attendees
  set checked_in_at = now(), check_in_method = 'photo', check_in_photo_path = p_photo_path
  where event_id = p_event_id and user_id = auth.uid();
end;
$$;

grant execute on function public.check_in_to_event(uuid, double precision, double precision, text) to authenticated;
