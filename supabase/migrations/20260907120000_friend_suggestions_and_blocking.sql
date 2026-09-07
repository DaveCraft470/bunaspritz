-- Friend suggestions (friends-of-friends + co-attendees) and real blocking.
--
-- Rewritten against friendships/friend_requests instead of follows: live
-- confirms public.follows doesn't exist (dropped outside of git history when
-- production moved to the request/accept model — see the TODO(phase 1) note
-- in 20260906160000_add_friend_requests.sql), and none of blocked/
-- is_blocked_by/block_user/unblock_user/suggest_friends exist live either, so
-- this file's original follows-based version was never actually applied to
-- production and there's nothing to preserve backwards-compatibility with.

-- ==================================================== friend_prefs.blocked ==
alter table public.friend_prefs
  add column blocked boolean not null default false;

-- Used by block_user()/suggest_friends() below, and by any RLS policy that
-- needs to check "did the other party block me" without being blocked by
-- friend_prefs' own "owner_id = auth.uid()" RLS (a correlated subquery run
-- as the calling role would have that row hidden from it). Not granted to
-- authenticated: only ever invoked from inside SECURITY DEFINER functions,
-- and exposing it directly would let anyone probe "did X block me".
create or replace function public.is_blocked_by(p_owner uuid, p_subject uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friend_prefs
    where owner_id = p_owner and subject_id = p_subject and blocked = true
  );
$$;

-- Blocking severs any existing connection both ways: it cancels/rejects any
-- pending friend_requests between the two and deletes the friendships row if
-- they were already friends. Runs as its owner since removing the *other*
-- person's side of a friendship/request isn't something normal RLS lets the
-- caller do on its own.
create or replace function public.block_user(p_subject uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid := least(auth.uid(), p_subject);
  b uuid := greatest(auth.uid(), p_subject);
begin
  if p_subject = auth.uid() then
    raise exception 'cannot block yourself';
  end if;

  insert into public.friend_prefs (owner_id, subject_id, blocked)
  values (auth.uid(), p_subject, true)
  on conflict (owner_id, subject_id) do update set blocked = true, updated_at = now();

  delete from public.friendships where user_a = a and user_b = b;

  update public.friend_requests
  set status = 'cancelled', updated_at = now()
  where status = 'pending'
    and ((sender_id = auth.uid() and receiver_id = p_subject)
      or (sender_id = p_subject and receiver_id = auth.uid()));
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_subject uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.friend_prefs set blocked = false, updated_at = now()
  where owner_id = auth.uid() and subject_id = p_subject;
$$;

grant execute on function public.unblock_user(uuid) to authenticated;

-- ==================================================== suggest_friends() ====
-- Client-side RLS only ever exposes friendship/attendance rows the caller is
-- part of, so friends-of-friends and co-attendee lookups can't be done from
-- the client. This runs as its owner to see the full graph, but always
-- traverses from auth.uid() — never a parameter — so nobody can enumerate
-- another user's social graph through it. Co-attendance goes through
-- visible_event_attendees, the one place hide_activity_from is enforced.
create or replace function public.suggest_friends(p_limit int default 10)
returns table (
  id uuid,
  name text,
  username text,
  bio text,
  avatar_url text,
  instagram_handle text,
  verified boolean,
  reason text,
  score bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with my_friends as (
    select case when user_a = auth.uid() then user_b else user_a end as id
    from public.friendships
    where user_a = auth.uid() or user_b = auth.uid()
  ),
  pending_pairs as (
    select case when sender_id = auth.uid() then receiver_id else sender_id end as id
    from public.friend_requests
    where status = 'pending' and (sender_id = auth.uid() or receiver_id = auth.uid())
  ),
  blocked_pairs as (
    select subject_id as id from public.friend_prefs where owner_id = auth.uid() and blocked = true
    union
    select owner_id as id from public.friend_prefs where subject_id = auth.uid() and blocked = true
  ),
  fof as (
    select
      case when fs.user_a = f1.id then fs.user_b else fs.user_a end as id,
      count(*) as score,
      'mutual'::text as reason
    from my_friends f1
    join public.friendships fs on fs.user_a = f1.id or fs.user_b = f1.id
    where (case when fs.user_a = f1.id then fs.user_b else fs.user_a end) <> auth.uid()
    group by 1
  ),
  co_attendees as (
    select vea2.user_id as id, count(distinct vea2.event_id) as score, 'event'::text as reason
    from public.visible_event_attendees vea1
    join public.visible_event_attendees vea2
      on vea2.event_id = vea1.event_id and vea2.user_id <> vea1.user_id
    where vea1.user_id = auth.uid()
    group by vea2.user_id
  ),
  combined as (
    select * from fof
    union all
    select * from co_attendees
  ),
  ranked as (
    select combined.id as id,
      max(combined.score) as score,
      case when bool_or(combined.reason = 'mutual') then 'mutual' else 'event' end as reason
    from combined
    group by combined.id
  )
  select p.id, p.name, p.username, p.bio, p.avatar_url, p.instagram_handle, p.verified, r.reason, r.score
  from ranked r
  join public.profiles p on p.id = r.id
  where r.id <> auth.uid()
    and r.id not in (select id from my_friends)
    and r.id not in (select id from pending_pairs)
    and r.id not in (select id from blocked_pairs)
  order by r.score desc
  limit p_limit;
$$;

grant execute on function public.suggest_friends(int) to authenticated;
