-- Private/public events with instant-vs-manual approval, plus the join
-- request queue a manual-approval host reviews. Defaults match today's
-- behavior exactly (public, instant) so existing events are unaffected.
alter table public.events
  add column visibility text not null default 'public' check (visibility in ('public', 'private')),
  add column approval_mode text not null default 'instant' check (approval_mode in ('instant', 'manual'));

-- ================================================== event_join_requests ====
-- Created before the events policy below, which references this table.
create table public.event_join_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, user_id)
);

create index event_join_requests_host_lookup_idx on public.event_join_requests (event_id, status);

alter table public.event_join_requests enable row level security;

create policy "requester sees own join requests"
  on public.event_join_requests for select
  using (user_id = auth.uid());

create policy "host sees join requests for their own events"
  on public.event_join_requests for select
  using (exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid()));

create policy "request to join as yourself"
  on public.event_join_requests for insert
  with check (user_id = auth.uid());

-- Only a pending request can be withdrawn — once the host has responded,
-- that decision is theirs to keep a record of, not the requester's to erase.
create policy "requester withdraws their own pending request"
  on public.event_join_requests for delete
  using (user_id = auth.uid() and status = 'pending');

-- No update policy for either side on purpose: the host's accept/reject
-- path goes through respond_join_request below, which (as a security
-- definer function) also performs the resulting event_attendees insert
-- atomically with the status change — something a plain RLS update policy
-- could never do on its own.

-- A private event is only discoverable by its host, its attendees, and
-- anyone with an open (any-status) join request — everyone else's `select`
-- on `events` (and the realtime INSERT/DELETE feeds in lib/events.ts, which
-- Supabase Realtime evaluates against this same policy per subscriber) now
-- excludes it entirely, not just in the UI.
drop policy "events are readable by any signed-in user" on public.events;

create policy "public events are readable by any signed-in user, private ones by the involved"
  on public.events for select
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or exists (select 1 from public.event_attendees ea where ea.event_id = id and ea.user_id = auth.uid())
    or exists (select 1 from public.event_join_requests r where r.event_id = id and r.user_id = auth.uid())
  );

-- event_attendees' insert policy so far only checked "is this you, and is
-- there room" (see 20260901150000_add_event_max_participants.sql) — it had
-- no idea an event could require approval at all. Manual-approval events now
-- only accept a direct join once their request has been accepted; the host
-- joining their own event, and instant-approval events, are unaffected.
drop policy "join as yourself, if there's room" on public.event_attendees;

create policy "join as yourself, if there's room and you're allowed in"
  on public.event_attendees for insert
  with check (
    user_id = auth.uid()
    and not public.event_is_full(event_id)
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and (
          e.host_id = auth.uid()
          or e.approval_mode = 'instant'
          or exists (
            select 1 from public.event_join_requests r
            where r.event_id = e.id and r.user_id = auth.uid() and r.status = 'accepted'
          )
        )
    )
  );

-- The host's one entry point for accepting/rejecting — security definer so
-- it can both flip the request's status and (on accept) insert the
-- resulting event_attendees row on the requester's behalf, none of which a
-- plain client-side RLS-scoped call could do in one atomic step.
create or replace function public.respond_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_user_id uuid;
  v_host_id uuid;
begin
  select r.event_id, r.user_id into v_event_id, v_user_id
  from public.event_join_requests r
  where r.id = p_request_id and r.status = 'pending';

  if v_event_id is null then
    raise exception 'request not found or already handled';
  end if;

  select host_id into v_host_id from public.events where id = v_event_id;
  if v_host_id is null or v_host_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if p_approve and public.event_is_full(v_event_id) then
    raise exception 'event is full';
  end if;

  update public.event_join_requests
  set status = case when p_approve then 'accepted' else 'rejected' end, responded_at = now()
  where id = p_request_id;

  if p_approve then
    insert into public.event_attendees (event_id, user_id)
    values (v_event_id, v_user_id)
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.respond_join_request(uuid, boolean) to authenticated;
