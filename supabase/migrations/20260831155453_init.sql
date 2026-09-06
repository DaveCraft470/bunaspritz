-- Core schema for real auth/profiles, an Instagram-style follow graph,
-- per-person mute/hide prefs, events + join, 1:1 messages, and push tokens.

-- ============================================================ profiles ====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  username text not null unique,
  bio text not null default '',
  avatar_url text,
  notify_friends_on_join boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by any signed-in user"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "users update only their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Seeds a profile row from signUp's options.data as soon as the auth user
-- exists — the app never inserts into profiles directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    'Ieșiri bune, oameni faini și seri de ținut minte. ✨'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================= follows ====
-- Directed, Instagram-style: A can follow B without B following back.
-- "Friends"/"mutual" = a follows row exists in both directions.
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

create policy "see follow edges you're part of"
  on public.follows for select
  using (follower_id = auth.uid() or followee_id = auth.uid());

create policy "follow as yourself"
  on public.follows for insert
  with check (follower_id = auth.uid());

create policy "unfollow as yourself"
  on public.follows for delete
  using (follower_id = auth.uid());

-- ======================================================== friend_prefs ====
-- One row per (owner, subject) pair, from owner's point of view.
-- mute_* = "I (owner) don't want notifications about subject's activity."
-- hide_activity_from = "I (owner) hide MY OWN activity from subject."
create table public.friend_prefs (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  mute_messages boolean not null default false,
  mute_activity boolean not null default false,
  hide_activity_from boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, subject_id),
  check (owner_id <> subject_id)
);

alter table public.friend_prefs enable row level security;

create policy "manage only your own friend prefs"
  on public.friend_prefs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================== events ====
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  detail text not null default '',
  emoji text not null default '🍹',
  color text not null default '#1FD460',
  lng double precision not null,
  lat double precision not null,
  genre text not null default '',
  created_at timestamptz not null default now()
);

create index events_host_idx on public.events (host_id);

alter table public.events enable row level security;

create policy "events are readable by any signed-in user"
  on public.events for select
  using (auth.role() = 'authenticated');

create policy "hosts create their own events"
  on public.events for insert
  with check (host_id = auth.uid());

create policy "hosts manage their own events"
  on public.events for update
  using (host_id = auth.uid());

create policy "hosts delete their own events"
  on public.events for delete
  using (host_id = auth.uid());

-- ===================================================== event_attendees ====
create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_attendees_user_idx on public.event_attendees (user_id);

alter table public.event_attendees enable row level security;

-- Deliberately narrow: only your own row is directly selectable. Everyone
-- else's attendance is only exposed through visible_event_attendees below,
-- which is the one place hide_activity_from is enforced.
create policy "see only your own attendance row directly"
  on public.event_attendees for select
  using (user_id = auth.uid());

create policy "join as yourself"
  on public.event_attendees for insert
  with check (user_id = auth.uid());

create policy "leave as yourself"
  on public.event_attendees for delete
  using (user_id = auth.uid());

-- This view's query runs as its owner (migrations run as `postgres`, which
-- bypasses RLS), so it can see every row in event_attendees and apply its
-- own hide_activity_from filter instead of the table's restrictive RLS —
-- auth.uid() still resolves correctly to the real calling user's JWT.
create view public.visible_event_attendees
with (security_invoker = false)
as
select ea.event_id, ea.user_id, ea.joined_at
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

-- ============================================================= messages ===
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index messages_thread_idx
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

alter table public.messages enable row level security;

create policy "see messages you sent or received"
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Enforced at the DB level, not just the UI: you can only message a mutual
-- (both follow-rows exist), matching the app's "friends" definition.
create policy "message only mutual friends"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.follows
      where follower_id = sender_id and followee_id = recipient_id
    )
    and exists (
      select 1 from public.follows
      where follower_id = recipient_id and followee_id = sender_id
    )
  );

create policy "recipients can mark messages read"
  on public.messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ========================================================= push_tokens ====
create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "manage only your own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
