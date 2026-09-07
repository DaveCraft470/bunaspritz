-- Replaces the mutual-follow "friends" model (directed follows, "friends" =
-- both follow-rows exist) with an explicit request -> accept flow. follows
-- is dropped outright: nothing else in the schema reads it once messaging's
-- friend gate (below) moves off it. Production had 8 follow edges / 2 mutual
-- pairs at the time of this migration — backfilled into friendships below
-- (once that table exists) so those pairs don't silently lose the ability
-- to message each other the moment follows goes away. One-directional
-- (non-mutual) follows have no equivalent under a request/accept model and
-- are not backfilled as invented "pending requests" — there's no record of
-- intent to request, just to follow.

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

-- Backstop against a race between two concurrent inserts — the normal path
-- never hits this because send_friend_request() below checks for (and
-- auto-accepts) an existing reverse-direction pending request first.
create unique index friend_requests_unique_pending
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';

create index friend_requests_receiver_idx on public.friend_requests (receiver_id, status);
create index friend_requests_sender_idx on public.friend_requests (sender_id, status);

alter table public.friend_requests enable row level security;

create policy "see requests you sent or received"
  on public.friend_requests for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- Plain RLS can't express "auto-accept the reverse pending request", so
-- INSERT is closed to the client entirely (revoked below) and
-- send_friend_request() is the only path in.
create policy "respond to requests you're party to"
  on public.friend_requests for update
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

revoke insert on public.friend_requests from authenticated;

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;

create policy "see friendships you're part of"
  on public.friendships for select
  using (user_a = auth.uid() or user_b = auth.uid());

-- No insert/delete policy at all — friendships are only ever created by
-- send_friend_request()/accept_friend_request() and removed by unfriend(),
-- both security definer.

insert into public.friendships (user_a, user_b)
select least(a.follower_id, a.followee_id), greatest(a.follower_id, a.followee_id)
from public.follows a
join public.follows b on a.follower_id = b.followee_id and a.followee_id = b.follower_id
where a.follower_id < a.followee_id
on conflict do nothing;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Sends a request, or — if the other person already has a pending request
-- to you — accepts theirs instead of creating a redundant second row. This
-- is also the only place friend_requests rows are ever inserted. No
-- blocking concept exists yet, so there's no is_blocked() check here —
-- add one when that lands rather than stubbing it out now.
create or replace function public.send_friend_request(p_receiver_id uuid)
returns public.friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_reverse_id uuid;
  v_row public.friend_requests;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;
  if v_sender = p_receiver_id then
    raise exception 'cannot send a friend request to yourself';
  end if;
  if public.are_friends(v_sender, p_receiver_id) then
    raise exception 'already friends';
  end if;

  select id into v_reverse_id
  from public.friend_requests
  where sender_id = p_receiver_id and receiver_id = v_sender and status = 'pending';

  if v_reverse_id is not null then
    update public.friend_requests
      set status = 'accepted', updated_at = now()
      where id = v_reverse_id
      returning * into v_row;

    insert into public.friendships (user_a, user_b)
      values (least(v_sender, p_receiver_id), greatest(v_sender, p_receiver_id))
      on conflict do nothing;

    return v_row;
  end if;

  insert into public.friend_requests (sender_id, receiver_id, status)
  values (v_sender, p_receiver_id, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.accept_friend_request(p_request_id uuid)
returns public.friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.friend_requests;
begin
  update public.friend_requests
    set status = 'accepted', updated_at = now()
    where id = p_request_id and receiver_id = auth.uid() and status = 'pending'
    returning * into v_row;

  if not found then
    raise exception 'no pending request found';
  end if;

  insert into public.friendships (user_a, user_b)
    values (least(v_row.sender_id, v_row.receiver_id), greatest(v_row.sender_id, v_row.receiver_id))
    on conflict do nothing;

  return v_row;
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.reject_friend_request(p_request_id uuid)
returns public.friend_requests
language sql
security definer
set search_path = public
as $$
  update public.friend_requests
    set status = 'rejected', updated_at = now()
    where id = p_request_id and receiver_id = auth.uid() and status = 'pending'
    returning *;
$$;

grant execute on function public.reject_friend_request(uuid) to authenticated;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns public.friend_requests
language sql
security definer
set search_path = public
as $$
  update public.friend_requests
    set status = 'cancelled', updated_at = now()
    where id = p_request_id and sender_id = auth.uid() and status = 'pending'
    returning *;
$$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;

create or replace function public.unfriend(p_other_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friendships
  where user_a = least(auth.uid(), p_other_id) and user_b = greatest(auth.uid(), p_other_id);
$$;

grant execute on function public.unfriend(uuid) to authenticated;

-- messages' friend gate moves from "both follow-rows exist" to are_friends()
-- — has to happen before follows is dropped below, since this policy is the
-- thing depending on that table.
drop policy "message only mutual friends" on public.messages;

create policy "message only friends"
  on public.messages for insert
  with check (sender_id = auth.uid() and public.are_friends(sender_id, recipient_id));

-- follow / friend_prefs / follows: friend_prefs (mute_messages, mute_activity,
-- hide_activity_from) keys on arbitrary (owner, subject) pairs and is
-- unaffected by this change — only follows itself goes away.
--
-- TODO(phase 1): public.follows can't be dropped yet — is_blocked_by(),
-- block_user() and unblock_user() (supabase/migrations/20260906140000_
-- friend_suggestions_and_blocking.sql) still select/delete from it, and
-- app/friends.tsx + app/messages.tsx call those RPCs directly for real
-- (non-mock) blocking. Dropping follows here would silently break every
-- block/unblock call at runtime. Phase 1 must repoint those functions at
-- friendships/friend_requests (or otherwise stop depending on follows)
-- before this drop can safely run.
-- drop policy "see follow edges you're part of" on public.follows;
-- drop policy "follow as yourself" on public.follows;
-- drop policy "unfollow as yourself" on public.follows;
-- drop table public.follows;

-- Live incoming-request badges, matching the existing pattern for
-- messages/events/profiles.
alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.friendships;
