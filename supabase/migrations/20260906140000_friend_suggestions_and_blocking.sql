-- Friend suggestions (friends-of-friends + co-attendees) and real blocking.

-- ==================================================== friend_prefs.blocked ==
alter table public.friend_prefs
  add column blocked boolean not null default false;

-- Used from the follows insert policy below. A plain correlated subquery on
-- friend_prefs inside a policy would run as the calling role (the blocked
-- person, re-following), and friend_prefs' own RLS ("owner_id = auth.uid()")
-- would hide the blocker's row from them — the check would silently pass.
-- This function is owned by the migration role (which bypasses RLS, same as
-- block_user()/suggest_friends() below), so it sees the row regardless of
-- caller. Not granted to authenticated: it's only ever invoked from inside
-- the policy, and exposing it directly would let anyone probe "did X block
-- me".
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

-- A blocked person must not be able to re-follow their blocker.
drop policy if exists "follow as yourself" on public.follows;

create policy "follow as yourself"
  on public.follows for insert
  with check (
    follower_id = auth.uid()
    and not public.is_blocked_by(followee_id, follower_id)
  );

-- Blocking severs the connection both ways, which requires deleting the
-- other person's follow row — something they alone can do under normal RLS
-- ("unfollow as yourself" requires follower_id = auth.uid()). This function
-- runs as its owner to cross that boundary, scoped to exactly the caller's
-- own block action.
create or replace function public.block_user(p_subject uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_subject = auth.uid() then
    raise exception 'cannot block yourself';
  end if;

  insert into public.friend_prefs (owner_id, subject_id, blocked)
  values (auth.uid(), p_subject, true)
  on conflict (owner_id, subject_id) do update set blocked = true, updated_at = now();

  delete from public.follows
  where (follower_id = auth.uid() and followee_id = p_subject)
     or (follower_id = p_subject and followee_id = auth.uid());
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
-- Client-side RLS only ever exposes follow/attendance rows the caller is
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
  with already_following as (
    select followee_id from public.follows where follower_id = auth.uid()
  ),
  blocked_pairs as (
    select subject_id as id from public.friend_prefs where owner_id = auth.uid() and blocked = true
    union
    select owner_id as id from public.friend_prefs where subject_id = auth.uid() and blocked = true
  ),
  fof as (
    select f2.followee_id as id, count(*) as score, 'mutual'::text as reason
    from public.follows f1
    join public.follows f2 on f2.follower_id = f1.followee_id
    where f1.follower_id = auth.uid()
      and f2.followee_id <> auth.uid()
    group by f2.followee_id
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
    and r.id not in (select followee_id from already_following)
    and r.id not in (select id from blocked_pairs)
  order by r.score desc
  limit p_limit;
$$;

grant execute on function public.suggest_friends(int) to authenticated;
