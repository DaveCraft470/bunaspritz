-- Sprint 7 — Gamification: XP, Levels, Streaks, Weekly Missions, Monthly
-- Challenges, City Explorer, Local Rankings. Trofee (badges,
-- 20260907170000_add_badges.sql) already covers Hidden/Rare Achievements —
-- this adds a parallel, independent XP/level/streak layer using the exact
-- same "trigger off the underlying state change, security-definer writer,
-- no client insert policy" idiom as that migration, hooked onto the same
-- events (check-in, review, host, join) rather than replacing anything.

create table public.user_xp (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  updated_at timestamptz not null default now()
);

alter table public.user_xp enable row level security;

create policy "xp is readable by any signed-in user"
  on public.user_xp for select
  using (auth.role() = 'authenticated');

-- No insert/update/delete policy for `authenticated` — award_xp() (security
-- definer) is the only writer, same reasoning as user_badges.

-- Classic stepped RPG curve: level N needs (N-1)^2 * 50 cumulative XP.
-- A pure function of xp, not stored — level is always derived, never drifts.
create or replace function public.xp_to_level(p_xp integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 50)) + 1)::integer;
$$;

-- Awards XP and updates the daily-activity streak in one place — every XP
-- trigger below calls this instead of writing user_xp directly, so streak
-- bookkeeping can't drift out of sync with XP awarding.
create or replace function public.award_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
  v_current_streak integer;
  v_longest_streak integer;
  v_today date := current_date;
begin
  insert into public.user_xp (user_id, xp, current_streak, longest_streak, last_activity_date)
  values (p_user_id, greatest(p_amount, 0), 1, 1, v_today)
  on conflict (user_id) do update
  set xp = public.user_xp.xp + greatest(p_amount, 0),
      updated_at = now();

  select last_activity_date, current_streak, longest_streak
    into v_last_date, v_current_streak, v_longest_streak
    from public.user_xp where user_id = p_user_id;

  if v_last_date is null or v_last_date = v_today then
    -- first-ever row (already seeded at streak=1 above) or already counted today
    null;
  elsif v_last_date = v_today - 1 then
    v_current_streak := v_current_streak + 1;
    update public.user_xp
    set current_streak = v_current_streak,
        longest_streak = greatest(v_longest_streak, v_current_streak),
        last_activity_date = v_today
    where user_id = p_user_id;
  else
    update public.user_xp
    set current_streak = 1,
        last_activity_date = v_today
    where user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.award_xp(uuid, integer) to authenticated;

-- ================================================================ XP hooks ==
-- +5 for joining (event_attendees insert — same statement joinEvent already
-- makes, no client change needed).
create or replace function public.trigger_xp_on_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_xp(new.user_id, 5);
  return new;
end;
$$;

drop trigger if exists xp_on_join on public.event_attendees;
create trigger xp_on_join
  after insert on public.event_attendees
  for each row execute function public.trigger_xp_on_join();

-- +20 for a confirmed check-in.
create or replace function public.trigger_xp_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.checked_in_at is not null and old.checked_in_at is null then
    perform public.award_xp(new.user_id, 20);
  end if;
  return new;
end;
$$;

drop trigger if exists xp_on_checkin on public.event_attendees;
create trigger xp_on_checkin
  after update on public.event_attendees
  for each row execute function public.trigger_xp_on_checkin();

-- +10 for writing a review, +5 to the person reviewed (only for a positive
-- one — no reward for leaving/receiving a bad review).
create or replace function public.trigger_xp_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_xp(new.reviewer_id, 10);
  if new.rating >= 4 then
    perform public.award_xp(new.subject_id, 5);
  end if;
  return new;
end;
$$;

drop trigger if exists xp_on_review on public.reviews;
create trigger xp_on_review
  after insert on public.reviews
  for each row execute function public.trigger_xp_on_review();

-- +30 for hosting (creating) an event.
create or replace function public.trigger_xp_on_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_id is not null then
    perform public.award_xp(new.host_id, 30);
  end if;
  return new;
end;
$$;

drop trigger if exists xp_on_event_created on public.events;
create trigger xp_on_event_created
  after insert on public.events
  for each row execute function public.trigger_xp_on_event_created();

-- ====================================================== gamification stats ==
-- One call for the whole profile header: XP/level/streak plus City
-- Explorer's distinct-locations count (same rounding-based dedup as
-- award_badges_for_user's v_distinct_locations).
create or replace function public.get_gamification_stats(p_user_id uuid)
returns table (xp integer, level integer, current_streak integer, longest_streak integer, distinct_locations integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(ux.xp, 0),
    public.xp_to_level(coalesce(ux.xp, 0)),
    coalesce(ux.current_streak, 0),
    coalesce(ux.longest_streak, 0),
    (
      select count(distinct round(e.lat::numeric, 3)::text || ',' || round(e.lng::numeric, 3)::text)::integer
      from public.event_attendees ea
      join public.events e on e.id = ea.event_id
      where ea.user_id = p_user_id and ea.checked_in_at is not null
    )
  from (select 1) as one
  left join public.user_xp ux on ux.user_id = p_user_id;
$$;

grant execute on function public.get_gamification_stats(uuid) to authenticated;

-- ============================================================== missions ===
-- A small fixed catalog (ids/criteria live in this function, not a table —
-- same "criteria fixed in code" idiom as award_badges_for_user) rather than
-- a full missions-content table, since the set is small and curated.
-- period_key scopes a claim to "this week" or "this month" so the same
-- mission can be completed again next period; the primary key makes a
-- double-claim within the same period a no-op.
create table public.mission_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_id text not null,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mission_id, period_key)
);

alter table public.mission_claims enable row level security;

create policy "see only your own mission claims"
  on public.mission_claims for select
  using (user_id = auth.uid());

-- No insert policy — claim_mission() (security definer) is the only writer,
-- since it has to re-validate the criterion server-side before awarding XP.

create or replace function public.current_period_key(p_period text)
returns text
language sql
stable
as $$
  select case
    when p_period = 'week' then to_char(date_trunc('week', now()), 'IYYY-IW')
    else to_char(date_trunc('month', now()), 'YYYY-MM')
  end;
$$;

-- Re-checks the actual criterion server-side (never trusts the client's
-- claim that it's eligible) before inserting the claim row and awarding XP.
-- Unknown mission ids are a no-op, not an error — a client on an older
-- catalog just silently can't claim a mission that no longer exists.
create or replace function public.claim_mission(p_mission_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_count integer;
  v_xp integer;
  v_week_start timestamptz := date_trunc('week', now());
  v_month_start timestamptz := date_trunc('month', now());
begin
  if p_mission_id = 'weekly_checkin_3' then
    v_period := public.current_period_key('week');
    select count(*) into v_count from public.event_attendees
      where user_id = auth.uid() and checked_in_at >= v_week_start;
    v_xp := 50;
    if v_count < 3 then return false; end if;
  elsif p_mission_id = 'weekly_review_1' then
    v_period := public.current_period_key('week');
    select count(*) into v_count from public.reviews
      where reviewer_id = auth.uid() and created_at >= v_week_start;
    v_xp := 20;
    if v_count < 1 then return false; end if;
  elsif p_mission_id = 'monthly_checkin_8' then
    v_period := public.current_period_key('month');
    select count(*) into v_count from public.event_attendees
      where user_id = auth.uid() and checked_in_at >= v_month_start;
    v_xp := 150;
    if v_count < 8 then return false; end if;
  elsif p_mission_id = 'monthly_host_1' then
    v_period := public.current_period_key('month');
    select count(*) into v_count from public.events
      where host_id = auth.uid() and created_at >= v_month_start;
    v_xp := 100;
    if v_count < 1 then return false; end if;
  else
    return false;
  end if;

  insert into public.mission_claims (user_id, mission_id, period_key)
  values (auth.uid(), p_mission_id, v_period)
  on conflict (user_id, mission_id, period_key) do nothing;

  if not found then
    return false;
  end if;

  perform public.award_xp(auth.uid(), v_xp);
  return true;
end;
$$;

grant execute on function public.claim_mission(text) to authenticated;

-- Scoped to just the current week/month's claims — a client comparing
-- "is this mission already claimed" only ever needs to know about the
-- period it's currently looking at, and this way the client never has to
-- reproduce current_period_key()'s ISO-week formatting itself to match.
create or replace function public.get_claimed_missions()
returns table (mission_id text)
language sql
security definer
set search_path = public
stable
as $$
  select mission_id from public.mission_claims
  where user_id = auth.uid()
    and period_key in (public.current_period_key('week'), public.current_period_key('month'));
$$;

grant execute on function public.get_claimed_missions() to authenticated;

-- ============================================================ local rankings ==
-- No existing "home city" concept anywhere in the schema — added here so
-- Local Rankings can actually be local, not just relabeled global. Nullable
-- and optional (edit-profile.tsx), same free-text idiom as bio.
alter table public.profiles add column city text;

create or replace function public.get_leaderboard(p_city text default null, p_limit integer default 20)
returns table (user_id uuid, name text, username text, avatar_url text, xp integer, level integer)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.username, p.avatar_url, ux.xp, public.xp_to_level(ux.xp)
  from public.user_xp ux
  join public.profiles p on p.id = ux.user_id
  where p_city is null or p.city = p_city
  order by ux.xp desc
  limit p_limit;
$$;

grant execute on function public.get_leaderboard(text, integer) to authenticated;
