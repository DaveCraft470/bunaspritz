-- Sprint 2 — group chat: reactions, reply, pinned messages, polls, edit/
-- delete, unread tracking. All writes to event_group_messages beyond the
-- original insert go through security-definer RPCs (same idiom as
-- check_in_to_event) rather than new UPDATE policies — there's still no
-- general UPDATE policy on the table, so a client can never touch
-- edited_at/deleted_at/pinned_at/pinned_by/poll_id directly.

alter table public.event_group_messages
  add column reply_to_id uuid references public.event_group_messages (id) on delete set null,
  add column edited_at timestamptz,
  add column deleted_at timestamptz,
  add column pinned_at timestamptz,
  add column pinned_by uuid references public.profiles (id);

-- reply_to_id is safe to allow straight through the existing insert policy —
-- it can only ever point at a message the sender could already read (same
-- event's group chat), no new privilege.

-- =================================================== message_reactions ====
-- One reaction per (message, user) — tapping a different emoji swaps it,
-- tapping the same one again clears it (see react_to_group_message). No
-- client insert/update/delete policy: writes only ever go through that RPC.
create table public.message_reactions (
  message_id uuid not null references public.event_group_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

create policy "attendees read reactions on their event's messages"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.event_group_messages m
      join public.event_attendees ea on ea.event_id = m.event_id
      where m.id = message_reactions.message_id and ea.user_id = auth.uid()
    )
  );

create or replace function public.react_to_group_message(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_existing text;
begin
  select event_id into v_event_id from public.event_group_messages where id = p_message_id and deleted_at is null;
  if not found then
    raise exception 'message not found';
  end if;

  if not exists (select 1 from public.event_attendees where event_id = v_event_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  select emoji into v_existing from public.message_reactions where message_id = p_message_id and user_id = auth.uid();

  if v_existing is not null and v_existing = p_emoji then
    delete from public.message_reactions where message_id = p_message_id and user_id = auth.uid();
  else
    insert into public.message_reactions (message_id, user_id, emoji)
    values (p_message_id, auth.uid(), p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

grant execute on function public.react_to_group_message(uuid, text) to authenticated;

-- ============================================ edit / delete / pin / unpin ==
create or replace function public.edit_group_message(p_message_id uuid, p_text text)
returns public.event_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_group_messages;
begin
  if length(trim(p_text)) = 0 or length(p_text) > 500 then
    raise exception 'invalid text';
  end if;

  update public.event_group_messages
  set text = p_text, edited_at = now()
  where id = p_message_id
    and sender_id = auth.uid()
    and deleted_at is null
    and media_type is null
    and poll_id is null
  returning * into v_row;

  if not found then
    raise exception 'not allowed';
  end if;

  return v_row;
end;
$$;

grant execute on function public.edit_group_message(uuid, text) to authenticated;

-- Sender can delete their own message; the event host can moderate anyone's.
-- Soft delete only (deleted_at) — the client renders a "message deleted"
-- placeholder instead of the original content/media.
create or replace function public.delete_group_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_sender_id uuid;
begin
  select event_id, sender_id into v_event_id, v_sender_id
  from public.event_group_messages where id = p_message_id;

  if not found then
    raise exception 'message not found';
  end if;

  if v_sender_id != auth.uid() and not exists (select 1 from public.events where id = v_event_id and host_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  update public.event_group_messages set deleted_at = now() where id = p_message_id;
end;
$$;

grant execute on function public.delete_group_message(uuid) to authenticated;

-- Only the event host can pin/unpin ("Organizator/admin poate fixa mesaj").
create or replace function public.pin_group_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.event_group_messages where id = p_message_id and deleted_at is null;
  if not found then
    raise exception 'message not found';
  end if;

  if not exists (select 1 from public.events where id = v_event_id and host_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  update public.event_group_messages set pinned_at = now(), pinned_by = auth.uid() where id = p_message_id;
end;
$$;

grant execute on function public.pin_group_message(uuid) to authenticated;

create or replace function public.unpin_group_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.event_group_messages where id = p_message_id;
  if not found then
    raise exception 'message not found';
  end if;

  if not exists (select 1 from public.events where id = v_event_id and host_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  update public.event_group_messages set pinned_at = null, pinned_by = null where id = p_message_id;
end;
$$;

grant execute on function public.unpin_group_message(uuid) to authenticated;

-- ======================================================= event_group_reads ==
-- One row per (event, user) — a personal "I've read up to here" bookmark,
-- used for the unread separator / jump-to-unread button. Plain RLS is
-- enough: there's nothing here that needs server-side validation beyond
-- ownership, unlike recently_viewed_events (no per-user cap to enforce).
create table public.event_group_reads (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_group_reads enable row level security;

create policy "see only your own group read marker"
  on public.event_group_reads for select
  using (user_id = auth.uid());

create policy "set your own group read marker"
  on public.event_group_reads for insert
  with check (user_id = auth.uid());

create policy "update your own group read marker"
  on public.event_group_reads for update
  using (user_id = auth.uid());

-- ============================================================ group polls ==
create table public.event_group_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.event_group_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.event_group_polls (id) on delete cascade,
  label text not null,
  position integer not null
);

create table public.event_group_poll_votes (
  poll_id uuid not null references public.event_group_polls (id) on delete cascade,
  option_id uuid not null references public.event_group_poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- A poll is posted into the thread as a message that points at it (like
-- media messages point at a storage path) rather than a parallel timeline.
alter table public.event_group_messages
  add column poll_id uuid references public.event_group_polls (id) on delete set null;

create index event_group_poll_votes_option_idx on public.event_group_poll_votes (option_id);

alter table public.event_group_polls enable row level security;
alter table public.event_group_poll_options enable row level security;
alter table public.event_group_poll_votes enable row level security;

create policy "attendees read their event's polls"
  on public.event_group_polls for select
  using (exists (select 1 from public.event_attendees where event_id = event_group_polls.event_id and user_id = auth.uid()));

create policy "attendees read poll options"
  on public.event_group_poll_options for select
  using (
    exists (
      select 1 from public.event_group_polls p
      join public.event_attendees ea on ea.event_id = p.event_id
      where p.id = event_group_poll_options.poll_id and ea.user_id = auth.uid()
    )
  );

-- Raw vote rows are readable (not just counts) so a client could in theory
-- show who voted for what — get_poll_results below only ever returns counts
-- + the caller's own vote, and that's what the UI actually uses; the table
-- itself follows the same "any attendee can see" model as event attendance.
create policy "attendees read poll votes"
  on public.event_group_poll_votes for select
  using (
    exists (
      select 1 from public.event_group_polls p
      join public.event_attendees ea on ea.event_id = p.event_id
      where p.id = event_group_poll_votes.poll_id and ea.user_id = auth.uid()
    )
  );

create or replace function public.create_group_poll(p_event_id uuid, p_question text, p_options text[])
returns public.event_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll_id uuid;
  v_message public.event_group_messages;
  v_option text;
  v_position integer := 0;
begin
  if not exists (select 1 from public.event_attendees where event_id = p_event_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  if trim(p_question) = '' or array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    raise exception 'invalid poll';
  end if;

  insert into public.event_group_polls (event_id, created_by, question)
  values (p_event_id, auth.uid(), trim(p_question))
  returning id into v_poll_id;

  foreach v_option in array p_options loop
    if trim(v_option) != '' then
      insert into public.event_group_poll_options (poll_id, label, position) values (v_poll_id, trim(v_option), v_position);
      v_position := v_position + 1;
    end if;
  end loop;

  insert into public.event_group_messages (event_id, sender_id, text, poll_id)
  values (p_event_id, auth.uid(), '', v_poll_id)
  returning * into v_message;

  return v_message;
end;
$$;

grant execute on function public.create_group_poll(uuid, text, text[]) to authenticated;

create or replace function public.vote_group_poll(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_closed timestamptz;
begin
  select event_id, closed_at into v_event_id, v_closed from public.event_group_polls where id = p_poll_id;
  if not found then
    raise exception 'poll not found';
  end if;
  if v_closed is not null then
    raise exception 'poll closed';
  end if;
  if not exists (select 1 from public.event_attendees where event_id = v_event_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.event_group_poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'invalid option';
  end if;

  insert into public.event_group_poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now();
end;
$$;

grant execute on function public.vote_group_poll(uuid, uuid) to authenticated;

-- Creator or event host can close a poll early.
create or replace function public.close_group_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_created_by uuid;
begin
  select event_id, created_by into v_event_id, v_created_by from public.event_group_polls where id = p_poll_id;
  if not found then
    raise exception 'poll not found';
  end if;
  if v_created_by != auth.uid() and not exists (select 1 from public.events where id = v_event_id and host_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  update public.event_group_polls set closed_at = now() where id = p_poll_id;
end;
$$;

grant execute on function public.close_group_poll(uuid) to authenticated;

-- Privacy-safe results (counts + "did I vote for this option"), same idiom
-- as event_attendee_count — the UI never needs the raw voter list.
create or replace function public.get_poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, "position" integer, vote_count integer, my_vote boolean)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.label, o.position,
    (select count(*)::integer from public.event_group_poll_votes v where v.option_id = o.id) as vote_count,
    exists(select 1 from public.event_group_poll_votes v where v.option_id = o.id and v.user_id = auth.uid()) as my_vote
  from public.event_group_poll_options o
  where o.poll_id = p_poll_id
  order by o.position;
$$;

grant execute on function public.get_poll_results(uuid) to authenticated;

-- Without this, postgres_changes subscriptions never fire for these tables —
-- same idiom as event_group_messages itself.
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.event_group_poll_votes;
alter publication supabase_realtime add table public.event_group_polls;
