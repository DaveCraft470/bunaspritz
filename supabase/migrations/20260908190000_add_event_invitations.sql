-- Real backend for event invitations — lib/eventInvitations.ts was a plain
-- in-memory array (see its own file header before this migration), so an
-- invite never left the sender's device and a different session/device
-- never saw it. This makes it a real table, has the invite itself live as a
-- message inside the recipient's DM thread (same "message points at an
-- entity via a nullable id column" idiom as event_group_messages.poll_id),
-- and gives both the chat card and the notification row one shared source
-- of truth (event_invites.status) so confirming from either surface shows
-- as confirmed on the other.

create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create index event_invites_recipient_idx on public.event_invites (recipient_id);
create index event_invites_sender_idx on public.event_invites (sender_id);

-- Only one *active* (pending/accepted) invite per (event, sender, recipient)
-- — matches the old mock's getEventInvitationForPair dedup exactly (a
-- declined invite can be re-sent, an active one can't be duplicated). A
-- plain unique constraint would block re-inviting after a decline; this
-- partial index doesn't.
create unique index event_invites_active_pair_idx
  on public.event_invites (event_id, sender_id, recipient_id)
  where status in ('pending', 'accepted');

alter table public.event_invites enable row level security;

-- No INSERT/UPDATE policy at all — every write goes through the two
-- security-definer RPCs below, same lockdown idiom as notifications.
create policy "see invites you sent or received"
  on public.event_invites for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

alter publication supabase_realtime add table public.event_invites;

-- The invite card lives inside the DM thread itself, same idiom as
-- event_group_messages.poll_id — set on delete set null (not cascade) so
-- deleting an invite (never happens today, but the FK should be defensive)
-- doesn't take the chat message with it.
alter table public.messages add column event_invite_id uuid references public.event_invites (id) on delete set null;

-- security definer so it can insert into both event_invites and messages
-- atomically, and re-checks are_friends() itself — the messages insert
-- policy's own are_friends requirement doesn't apply here since this bypasses
-- RLS entirely, so it has to be re-enforced explicitly.
create or replace function public.send_event_invitation(p_event_id uuid, p_recipient_id uuid)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_message public.messages;
begin
  if p_recipient_id = auth.uid() then
    raise exception 'cannot invite yourself';
  end if;
  if not public.are_friends(auth.uid(), p_recipient_id) then
    raise exception 'not friends';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event not found';
  end if;
  if exists (
    select 1 from public.event_invites
    where event_id = p_event_id and sender_id = auth.uid() and recipient_id = p_recipient_id
      and status in ('pending', 'accepted')
  ) then
    raise exception 'already invited';
  end if;

  insert into public.event_invites (event_id, sender_id, recipient_id)
  values (p_event_id, auth.uid(), p_recipient_id)
  returning id into v_invite_id;

  insert into public.messages (sender_id, recipient_id, text, event_invite_id)
  values (auth.uid(), p_recipient_id, '', v_invite_id)
  returning * into v_message;

  return v_message;
end;
$$;

grant execute on function public.send_event_invitation(uuid, uuid) to authenticated;

-- Mirrors respond_join_request: flips status and, on accept, inserts the
-- event_attendees row atomically. A personal invite from a friend bypasses
-- manual-approval the same way the host joining their own event does — it's
-- a direct invite, not a cold request — but still respects capacity.
create or replace function public.respond_event_invitation(p_invitation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_recipient_id uuid;
begin
  select event_id, recipient_id into v_event_id, v_recipient_id
  from public.event_invites
  where id = p_invitation_id and status = 'pending';

  if v_event_id is null then
    raise exception 'invitation not found or already handled';
  end if;
  if v_recipient_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  if p_accept and public.event_is_full(v_event_id) then
    raise exception 'event is full';
  end if;

  update public.event_invites
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_invitation_id;

  if p_accept then
    insert into public.event_attendees (event_id, user_id)
    values (v_event_id, auth.uid())
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.respond_event_invitation(uuid, boolean) to authenticated;
