-- Lets EventsContext's subscribeToNewEvents see other users' newly
-- published events live, not just after a manual refetch.
alter publication supabase_realtime add table public.events;
