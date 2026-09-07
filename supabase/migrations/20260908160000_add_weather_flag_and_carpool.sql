-- Sprint 8 — Weather-aware Events (is_outdoor flag, so a rain/heat alert
-- only fires for events it actually applies to, and "Indoor Alternative"
-- can suggest genuinely indoor events back) and Carpooling.

alter table public.events add column is_outdoor boolean not null default false;

-- ==================================================== event_carpool_offers ==
-- "Am mașină" — a driver offers seats; attendees can see all offers for
-- their event. One offer per (event, driver) — editing seats is a re-upsert.
create table public.event_carpool_offers (
  event_id uuid not null references public.events (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  seats_available integer not null check (seats_available > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);

alter table public.event_carpool_offers enable row level security;

create policy "attendees read their event's carpool offers"
  on public.event_carpool_offers for select
  using (exists (select 1 from public.event_attendees where event_id = event_carpool_offers.event_id and user_id = auth.uid()));

create policy "attendees create their own carpool offer"
  on public.event_carpool_offers for insert
  with check (
    driver_id = auth.uid()
    and exists (select 1 from public.event_attendees where event_id = event_carpool_offers.event_id and user_id = auth.uid())
  );

create policy "drivers update their own carpool offer"
  on public.event_carpool_offers for update
  using (driver_id = auth.uid());

create policy "drivers remove their own carpool offer"
  on public.event_carpool_offers for delete
  using (driver_id = auth.uid());

-- ================================================== event_carpool_requests ==
-- "Caut transport" — a plain flag, not matched to a specific driver (riders
-- and drivers coordinate themselves via the offer's note / the event's
-- existing group chat and meetup point — no in-app matching engine here).
create table public.event_carpool_requests (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_carpool_requests enable row level security;

create policy "attendees read their event's carpool requests"
  on public.event_carpool_requests for select
  using (exists (select 1 from public.event_attendees where event_id = event_carpool_requests.event_id and user_id = auth.uid()));

create policy "attendees create their own carpool request"
  on public.event_carpool_requests for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.event_attendees where event_id = event_carpool_requests.event_id and user_id = auth.uid())
  );

create policy "riders remove their own carpool request"
  on public.event_carpool_requests for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.event_carpool_offers;
alter publication supabase_realtime add table public.event_carpool_requests;
