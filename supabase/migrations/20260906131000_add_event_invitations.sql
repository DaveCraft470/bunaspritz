-- Inviting a specific friend to an event, distinct from just joining a
-- public one — no backend or UI exists for this at all today.

create table public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

-- One pending invite per (event, recipient) at a time — re-inviting after a
-- reject/cancel is fine (status has moved off 'pending' by then).
create unique index event_invitations_unique_pending
  on public.event_invitations (event_id, recipient_id)
  where status = 'pending';

create index event_invitations_recipient_idx on public.event_invitations (recipient_id, status);

alter table public.event_invitations enable row level security;

create policy "see invitations you sent or received"
  on public.event_invitations for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- INSERT is closed to the client (revoked below) — send_event_invitation()
-- is the only path in, since it has to check host/attendee + friendship +
-- not-already-attending together.
revoke insert on public.event_invitations from authenticated;

create or replace function public.send_event_invitation(p_event_id uuid, p_recipient_id uuid)
returns public.event_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_row public.event_invitations;
begin
  if v_sender = p_recipient_id then
    raise exception 'cannot invite yourself';
  end if;
  if not public.are_friends(v_sender, p_recipient_id) then
    raise exception 'can only invite friends';
  end if;
  if public.is_blocked(v_sender, p_recipient_id) then
    raise exception 'blocked';
  end if;
  if not exists (
    select 1 from public.events e where e.id = p_event_id and e.host_id = v_sender
    union
    select 1 from public.event_attendees ea where ea.event_id = p_event_id and ea.user_id = v_sender
  ) then
    raise exception 'only the host or an attendee can invite';
  end if;
  if exists (select 1 from public.event_attendees where event_id = p_event_id and user_id = p_recipient_id) then
    raise exception 'already attending';
  end if;

  insert into public.event_invitations (event_id, sender_id, recipient_id)
  values (p_event_id, v_sender, p_recipient_id)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_event_invitation(uuid, uuid) to authenticated;

create or replace function public.accept_event_invitation(p_invitation_id uuid)
returns public.event_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_invitations;
begin
  update public.event_invitations
    set status = 'accepted', responded_at = now()
    where id = p_invitation_id and recipient_id = auth.uid() and status = 'pending'
    returning * into v_row;

  if not found then
    raise exception 'no pending invitation found';
  end if;
  if public.event_is_full(v_row.event_id) then
    raise exception 'event is full';
  end if;

  insert into public.event_attendees (event_id, user_id)
  values (v_row.event_id, auth.uid())
  on conflict do nothing;

  return v_row;
end;
$$;

grant execute on function public.accept_event_invitation(uuid) to authenticated;

create or replace function public.reject_event_invitation(p_invitation_id uuid)
returns public.event_invitations
language sql
security definer
set search_path = public
as $$
  update public.event_invitations
    set status = 'rejected', responded_at = now()
    where id = p_invitation_id and recipient_id = auth.uid() and status = 'pending'
    returning *;
$$;

grant execute on function public.reject_event_invitation(uuid) to authenticated;

create or replace function public.cancel_event_invitation(p_invitation_id uuid)
returns public.event_invitations
language sql
security definer
set search_path = public
as $$
  update public.event_invitations
    set status = 'cancelled', responded_at = now()
    where id = p_invitation_id and sender_id = auth.uid() and status = 'pending'
    returning *;
$$;

grant execute on function public.cancel_event_invitation(uuid) to authenticated;
