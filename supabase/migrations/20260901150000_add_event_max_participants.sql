-- Optional capacity cap for an event — null means unlimited, matching the
-- existing optional entry_fee_ron/drinks_price_ron columns rather than
-- forcing every host to pick a number.
alter table public.events
  add column max_participants integer,
  add constraint events_max_participants_positive check (max_participants is null or max_participants > 0);

-- Same idiom as reviews' can_review: event_attendees' own RLS only exposes
-- your own row directly, so counting *all* attendees of an event needs a
-- security-definer function rather than an inline subquery in the policy.
create or replace function public.event_is_full(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.max_participants is not null
      and e.max_participants <= (
        select count(*) from public.event_attendees ea where ea.event_id = e.id
      )
  );
$$;

grant execute on function public.event_is_full(uuid) to authenticated;

drop policy "join as yourself" on public.event_attendees;

create policy "join as yourself, if there's room"
  on public.event_attendees for insert
  with check (user_id = auth.uid() and not public.event_is_full(event_id));
