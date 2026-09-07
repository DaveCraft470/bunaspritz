-- Real, persisted Trofee (badge) system. Award-checking runs entirely
-- server-side via triggers so it fires regardless of which client code path
-- changed the underlying state (RPC or direct insert) — see
-- award_badges_for_user() below, which re-evaluates all 9 criteria and is
-- idempotent per badge (award_badge() is a no-op if already earned).
create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  event_id uuid references public.events (id) on delete set null,
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "see your own badges"
  on public.user_badges for select
  using (auth.uid() = user_id);

-- Deliberately no insert/update/delete policy for `authenticated` — the only
-- writer is award_badge() below (security definer, bypasses RLS), so a
-- client can't award itself a badge directly.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'friend_request', 'friend_request_accepted', 'message', 'event_invite',
    'event_join', 'event_cancelled', 'event_updated', 'review', 'system',
    'badge_earned'
  ]));

create or replace function public.award_badge(p_user_id uuid, p_badge_id text, p_title text, p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_badges (user_id, badge_id, event_id)
  values (p_user_id, p_badge_id, p_event_id)
  on conflict (user_id, badge_id) do nothing;

  if found then
    insert into public.notifications (recipient_id, actor_id, type, title, body, data)
    values (p_user_id, p_user_id, 'badge_earned', 'Ai obținut un trofeu nou!', p_title, jsonb_build_object('target_id', p_badge_id));
  end if;
end;
$$;

-- Evaluates all 9 confirmed badge criteria for one user. "Attended" means
-- checked in (event_attendees.checked_in_at), not just joined. Distinct
-- locations are counted by rounding lat/lng to ~110m precision, since raw
-- float coordinates rarely repeat exactly even for the same venue.
create or replace function public.award_badges_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attended_count integer;
  v_first_attended_event uuid;
  v_distinct_locations integer;
  v_hosted_count integer;
  v_first_hosted_event uuid;
  v_positive_review_count integer;
  v_main_character_event uuid;
  v_is_verified boolean;
begin
  if p_user_id is null then
    return;
  end if;

  select ea.event_id into v_first_attended_event
    from public.event_attendees ea
    where ea.user_id = p_user_id and ea.checked_in_at is not null
    order by ea.checked_in_at asc
    limit 1;

  select count(*) into v_attended_count
    from public.event_attendees ea
    where ea.user_id = p_user_id and ea.checked_in_at is not null;

  if v_attended_count >= 1 then
    perform public.award_badge(p_user_id, 'primul_pahar', 'Primul Pahar', v_first_attended_event);
    perform public.award_badge(p_user_id, 'certified_spritzer_minus15', 'Certified Spritzer -15', v_first_attended_event);
  end if;

  select count(distinct round(e.lat::numeric, 3)::text || ',' || round(e.lng::numeric, 3)::text)
    into v_distinct_locations
    from public.event_attendees ea
    join public.events e on e.id = ea.event_id
    where ea.user_id = p_user_id and ea.checked_in_at is not null;

  if v_distinct_locations >= 5 then
    perform public.award_badge(p_user_id, 'pierdut_prin_oras', 'Pierdut prin Oraș', null);
  end if;
  if v_distinct_locations >= 10 then
    perform public.award_badge(p_user_id, 'inspector_de_spritz', 'Inspector de Spritz', null);
  end if;

  select count(*) into v_hosted_count from public.events where host_id = p_user_id;

  if v_hosted_count >= 1 then
    select id into v_first_hosted_event from public.events where host_id = p_user_id order by created_at asc limit 1;
    perform public.award_badge(p_user_id, 'project_x', 'project X', v_first_hosted_event);
  end if;
  if v_hosted_count >= 10 then
    perform public.award_badge(p_user_id, 'spritz_boss', 'Spritz Boss', null);
  end if;

  select count(*) into v_positive_review_count
    from public.reviews
    where subject_id = p_user_id and rating >= 4;

  if v_positive_review_count >= 10 then
    perform public.award_badge(p_user_id, 'good_vibes', 'Good vibes', null);
  end if;

  -- "≥5 distinct people, all from the same single event" — group by event,
  -- take the event with the most distinct positive reviewers if it clears 5.
  select event_id into v_main_character_event
    from public.reviews
    where subject_id = p_user_id and rating >= 4
    group by event_id
    having count(distinct reviewer_id) >= 5
    order by count(distinct reviewer_id) desc
    limit 1;

  if v_main_character_event is not null then
    perform public.award_badge(p_user_id, 'main_character', 'Main Character', v_main_character_event);
  end if;

  select verified into v_is_verified from public.profiles where id = p_user_id;
  if coalesce(v_is_verified, false) then
    perform public.award_badge(p_user_id, 'identity_verified', 'Identity Verified', null);
  end if;
end;
$$;

grant execute on function public.award_badges_for_user(uuid) to authenticated;

-- Trigger wiring below fires award_badges_for_user() from the underlying
-- state changes directly (not from client RPC call sites), so it doesn't
-- need app-code changes at every check-in/review/event-creation path and
-- can't be bypassed by calling a table insert/update directly.
create or replace function public.trigger_award_badges_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.checked_in_at is not null and old.checked_in_at is null then
    perform public.award_badges_for_user(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists award_badges_on_checkin on public.event_attendees;
create trigger award_badges_on_checkin
  after update on public.event_attendees
  for each row execute function public.trigger_award_badges_checkin();

create or replace function public.trigger_award_badges_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_badges_for_user(new.subject_id);
  return new;
end;
$$;

drop trigger if exists award_badges_on_review on public.reviews;
create trigger award_badges_on_review
  after insert on public.reviews
  for each row execute function public.trigger_award_badges_review();

create or replace function public.trigger_award_badges_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.host_id is not null then
    perform public.award_badges_for_user(new.host_id);
  end if;
  return new;
end;
$$;

drop trigger if exists award_badges_on_event_created on public.events;
create trigger award_badges_on_event_created
  after insert on public.events
  for each row execute function public.trigger_award_badges_event_created();

create or replace function public.trigger_award_badges_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified is true and old.verified is distinct from true then
    perform public.award_badges_for_user(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists award_badges_on_verified on public.profiles;
create trigger award_badges_on_verified
  after update on public.profiles
  for each row execute function public.trigger_award_badges_verified();
