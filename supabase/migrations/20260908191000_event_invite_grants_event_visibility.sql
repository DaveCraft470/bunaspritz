-- Gap in 20260908190000: a private event's own SELECT policy didn't account
-- for an invited (not-yet-attendee) recipient — they'd see a blank title on
-- the chat invite card (the events(title) embed silently returns null when
-- RLS blocks it) and couldn't even open the event page to review it before
-- responding. An invite is as strong a visibility signal as an open join
-- request, which this policy already grants.
drop policy "public events are readable by any signed-in user, private ones by the involved" on public.events;

create policy "public events are readable by any signed-in user, private ones by the involved"
  on public.events for select
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or exists (select 1 from public.event_attendees ea where ea.event_id = id and ea.user_id = auth.uid())
    or exists (select 1 from public.event_join_requests r where r.event_id = id and r.user_id = auth.uid())
    or exists (select 1 from public.event_invites ei where ei.event_id = id and ei.recipient_id = auth.uid())
  );
