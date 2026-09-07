-- Sprint 3 — Meetup Point (any attendee can set/move a single meeting pin
-- for the event) and Event Photo Album (a persistent, shared gallery —
-- distinct from the private checkin-photos bucket and the ephemeral
-- event_group_messages media, see those migrations for the difference).

-- ==================================================== event_meetup_points ==
-- One row per event — "whoever sets it last wins", same as a shared pin on a
-- group map. Plain RLS: any attendee can read/upsert, no RPC needed since
-- there's nothing here that needs server-side validation beyond membership.
create table public.event_meetup_points (
  event_id uuid primary key references public.events (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  label text not null default '',
  set_by uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.event_meetup_points enable row level security;

create policy "attendees read their event's meetup point"
  on public.event_meetup_points for select
  using (exists (select 1 from public.event_attendees where event_id = event_meetup_points.event_id and user_id = auth.uid()));

create policy "attendees set their event's meetup point"
  on public.event_meetup_points for insert
  with check (
    set_by = auth.uid()
    and exists (select 1 from public.event_attendees where event_id = event_meetup_points.event_id and user_id = auth.uid())
  );

create policy "attendees move their event's meetup point"
  on public.event_meetup_points for update
  using (exists (select 1 from public.event_attendees where event_id = event_meetup_points.event_id and user_id = auth.uid()))
  with check (
    set_by = auth.uid()
    and exists (select 1 from public.event_attendees where event_id = event_meetup_points.event_id and user_id = auth.uid())
  );

alter publication supabase_realtime add table public.event_meetup_points;

-- =========================================================== event_photos ==
create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create index event_photos_event_idx on public.event_photos (event_id, created_at desc);

alter table public.event_photos enable row level security;

create policy "attendees read their event's photo album"
  on public.event_photos for select
  using (exists (select 1 from public.event_attendees where event_id = event_photos.event_id and user_id = auth.uid()));

create policy "attendees add photos to their event's album"
  on public.event_photos for insert
  with check (
    uploader_id = auth.uid()
    and exists (select 1 from public.event_attendees where event_id = event_photos.event_id and user_id = auth.uid())
  );

-- Uploader can delete their own; the host can moderate anyone's — same
-- "sender or host" idiom as delete_group_message.
create policy "uploader or host deletes an album photo"
  on public.event_photos for delete
  using (
    uploader_id = auth.uid()
    or exists (select 1 from public.events where id = event_photos.event_id and host_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', false)
on conflict (id) do nothing;

-- Path convention: `${eventId}/${uploaderId}-${timestamp}-rand.ext` — the
-- event id lives in the first path segment so these policies can check
-- attendance/host status without needing a join through event_photos itself
-- (mirrors 20260907180000's "read group message media if attendee", which
-- does join through a table since media_path there isn't self-describing).
create policy "upload photos to your event's album"
  on storage.objects for insert
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_attendees
      where event_id = ((storage.foldername(name))[1])::uuid
        and user_id = auth.uid()
    )
  );

create policy "read event album photos if attendee"
  on storage.objects for select
  using (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_attendees
      where event_id = ((storage.foldername(name))[1])::uuid
        and user_id = auth.uid()
    )
  );

create policy "delete event album photos if uploader or host"
  on storage.objects for delete
  using (
    bucket_id = 'event-photos'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.events
        where id = ((storage.foldername(name))[1])::uuid and host_id = auth.uid()
      )
    )
  );
