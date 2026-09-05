-- Blocking has no backend at all today — no table, no enforcement anywhere.
-- Lands first (ahead of the friend-request rework) because send_friend_request
-- and the messages policy both need is_blocked() to exist already.

create table public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- Deliberately one-directional: you can see who *you* blocked, never who
-- blocked *you* (that would defeat the point — someone could confirm a
-- block landed by checking whether they show up in the other person's list,
-- except this policy means they can't query the other person's list at all).
create policy "see only your own block list"
  on public.blocked_users for select
  using (blocker_id = auth.uid());

create policy "unblock only your own blocks"
  on public.blocked_users for delete
  using (blocker_id = auth.uid());

-- No direct insert policy — blocking goes through block_user() below so it
-- can also tear down any existing friendship/pending request in the same
-- transaction (a blocked "friend" must stop being one).
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create or replace function public.block_user(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocker uuid := auth.uid();
begin
  if v_blocker is null then
    raise exception 'not authenticated';
  end if;
  if v_blocker = p_target_id then
    raise exception 'cannot block yourself';
  end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_blocker, p_target_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friend_requests
  where (sender_id = v_blocker and receiver_id = p_target_id)
     or (sender_id = p_target_id and receiver_id = v_blocker);

  delete from public.friendships
  where user_a = least(v_blocker, p_target_id) and user_b = greatest(v_blocker, p_target_id);
end;
$$;

create or replace function public.unblock_user(p_target_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocked_users
  where blocker_id = auth.uid() and blocked_id = p_target_id;
$$;

-- Both reference friend_requests/friendships, which don't exist yet — fine,
-- plpgsql/sql function bodies aren't validated against dependent objects
-- until first executed, and the very next migration creates both tables
-- before anything can call these.
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
