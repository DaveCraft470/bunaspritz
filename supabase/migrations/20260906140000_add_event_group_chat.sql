-- Event group chat: membership is exactly event_attendees (no separate
-- table), so the group "exists" the moment the event does — the host is
-- already auto-added to event_attendees by createEvent (lib/events.ts), and
-- leaving event_attendees (leaveEvent) drops the group too since select
-- access below is gated on the same table.
create table public.event_group_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  -- True for the auto-posted "X joined the event" line (see the trigger
  -- below) — never set by a client insert, see the insert policy.
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index event_group_messages_event_idx on public.event_group_messages (event_id, created_at);

alter table public.event_group_messages enable row level security;

create policy "attendees read their event's group chat"
  on public.event_group_messages for select
  using (
    exists (
      select 1 from public.event_attendees
      where event_id = event_group_messages.event_id
        and user_id = auth.uid()
    )
  );

create policy "attendees post in their event's group chat"
  on public.event_group_messages for insert
  with check (
    sender_id = auth.uid()
    and is_system = false
    and exists (
      select 1 from public.event_attendees
      where event_id = event_group_messages.event_id
        and user_id = auth.uid()
    )
  );

-- Without this, postgres_changes subscriptions never fire — same idiom as
-- messages (see 20260831161251_enable_realtime_messages.sql).
alter publication supabase_realtime add table public.event_group_messages;

-- Posts "X s-a alăturat evenimentului" the moment someone joins.
-- security definer so it can insert an is_system row despite the insert
-- policy above requiring is_system = false for ordinary (client) inserts.
-- Skips the host's own row: createEvent's insert into event_attendees is
-- event creation, not "joining", so it shouldn't announce itself.
create or replace function public.post_event_join_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_host boolean;
  joiner_name text;
begin
  select (host_id = new.user_id) into is_host from public.events where id = new.event_id;
  if coalesce(is_host, false) then
    return new;
  end if;

  select coalesce(nullif(name, ''), '@' || username) into joiner_name
  from public.profiles where id = new.user_id;

  insert into public.event_group_messages (event_id, sender_id, text, is_system)
  values (new.event_id, new.user_id, coalesce(joiner_name, 'Cineva') || ' s-a alăturat evenimentului 🎉', true);

  return new;
end;
$$;

create trigger on_event_attendee_joined
  after insert on public.event_attendees
  for each row execute function public.post_event_join_message();
