-- Lets the client subscribe to its own profile row, so `verified` flips
-- live once didit-webhook approves a session, instead of needing a poll.
alter publication supabase_realtime add table public.profiles;
