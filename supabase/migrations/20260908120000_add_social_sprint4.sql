-- Sprint 4 — social: "Cine iese?" (temporary going-out status, visible to
-- friends), "Merg singur" (per-attendance flag), Favorite Categories/
-- Locations, and Common Events. Follow Organizer reuses the existing
-- `follows` table from the init migration (never wired up client-side until
-- now) — no schema change needed for that one.

-- ====================================================== going_out_status ==
-- One row per user — setting a new status just overwrites the old one
-- (upsert). "Expires automatically" is enforced by every reader filtering
-- expires_at > now(), same as how discovery.ts already treats startsAt —
-- no cron/cleanup job needed, an expired row is just never shown again.
create table public.going_out_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.going_out_status enable row level security;

create policy "see your own or a friend's going-out status"
  on public.going_out_status for select
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy "set your own going-out status"
  on public.going_out_status for insert
  with check (user_id = auth.uid());

create policy "update your own going-out status"
  on public.going_out_status for update
  using (user_id = auth.uid());

create policy "clear your own going-out status"
  on public.going_out_status for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.going_out_status;

-- =========================================== event_attendees.going_alone ==
-- No general UPDATE policy exists on event_attendees (checked_in_at etc. are
-- deliberately only settable via check_in_to_event) — same idiom here: a
-- narrow RPC that can only ever touch going_alone on the caller's own row.
alter table public.event_attendees add column going_alone boolean not null default false;

create or replace function public.set_going_alone(p_event_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_attendees
  set going_alone = p_value
  where event_id = p_event_id and user_id = auth.uid();

  if not found then
    raise exception 'not joined';
  end if;
end;
$$;

grant execute on function public.set_going_alone(uuid, boolean) to authenticated;

-- visible_event_attendees (20260831155453_init.sql) needs to expose
-- going_alone too, or the attendee list would have no way to read anyone
-- else's flag — event_attendees' own SELECT policy only allows a caller to
-- read their own row directly. create or replace view is safe here (same
-- columns plus one more, nothing dependent breaks).
create or replace view public.visible_event_attendees
with (security_invoker = false)
as
select ea.event_id, ea.user_id, ea.joined_at, ea.going_alone
from public.event_attendees ea
where ea.user_id = auth.uid()
   or not exists (
     select 1
     from public.friend_prefs fp
     where fp.owner_id = ea.user_id
       and fp.subject_id = auth.uid()
       and fp.hide_activity_from = true
   );

grant select on public.visible_event_attendees to authenticated;

-- ===================================================== favorite categories ==
-- Public (any signed-in user can read) — used for Common Interests between
-- two profiles and Event Matching on an event's attendee list, same "public
-- preference" model as profiles.name/bio.
create table public.favorite_categories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.favorite_categories enable row level security;

create policy "favorite categories are readable by any signed-in user"
  on public.favorite_categories for select
  using (auth.role() = 'authenticated');

create policy "add your own favorite categories"
  on public.favorite_categories for insert
  with check (user_id = auth.uid());

create policy "remove your own favorite categories"
  on public.favorite_categories for delete
  using (user_id = auth.uid());

-- ===================================================== favorite locations ==
-- Private (unlike categories) — a saved point can be a home/work address,
-- not something to expose to just any signed-in user.
create table public.favorite_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table public.favorite_locations enable row level security;

create policy "see only your own favorite locations"
  on public.favorite_locations for select
  using (user_id = auth.uid());

create policy "add your own favorite locations"
  on public.favorite_locations for insert
  with check (user_id = auth.uid());

create policy "remove your own favorite locations"
  on public.favorite_locations for delete
  using (user_id = auth.uid());

-- ============================================================ common events ==
-- Reading another user's event_attendees rows directly isn't allowed by RLS
-- ("see only your own attendance row directly") — same reasoning as
-- can_review, security definer so it can see both sides, but only ever
-- returns events where BOTH the caller and p_other_id actually checked in,
-- never anything about the other person's attendance in general.
create or replace function public.get_common_events(p_other_id uuid)
returns table (event_id uuid, title text, starts_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.title, e.starts_at
  from public.event_attendees mine
  join public.event_attendees theirs
    on theirs.event_id = mine.event_id and theirs.user_id = p_other_id
  join public.events e on e.id = mine.event_id
  where mine.user_id = auth.uid()
    and mine.checked_in_at is not null
    and theirs.checked_in_at is not null
  order by e.starts_at desc nulls last;
$$;

grant execute on function public.get_common_events(uuid) to authenticated;
