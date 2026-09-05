-- In-app notification center backing store. No screen reads this yet (none
-- exists), but the four notify-* edge functions are updated alongside this
-- migration to insert a row here every time they send a push, so the table
-- isn't empty on day one once a UI lands.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in (
    'friend_request', 'friend_request_accepted', 'message', 'event_invite',
    'event_join', 'event_cancelled', 'event_update', 'review', 'system'
  )),
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "see only your own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

-- Same lockdown idiom as messages.read_at / profiles.verified: RLS alone
-- can't stop a client from setting other columns on their own row, so the
-- UPDATE grant is narrowed to read_at only. No INSERT policy at all — every
-- row is written by the service role (edge functions), never the client.
create policy "mark only your own notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.unread_notification_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.notifications
  where recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
    set read_at = now()
    where id = p_notification_id and recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
    set read_at = now()
    where recipient_id = auth.uid() and read_at is null;
$$;

grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

alter publication supabase_realtime add table public.notifications;
