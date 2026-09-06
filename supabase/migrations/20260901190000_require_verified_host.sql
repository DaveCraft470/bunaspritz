-- "Host verification" had no backend behind it at all — hostVerified lived
-- only in an in-memory client toggle (contexts/DevFlagsContext, now
-- removed), reachable by any signed-in user, and the events INSERT policy
-- never checked anything beyond host_id = auth.uid(). Anyone could create
-- real events regardless of that toggle. Now requires the same identity
-- verification already required to join an event, enforced here instead of
-- inventing a separate, undefined "host verification" concept.
drop policy "hosts create their own events" on public.events;

create policy "verified hosts create their own events"
  on public.events for insert
  with check (
    host_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.verified = true)
  );
