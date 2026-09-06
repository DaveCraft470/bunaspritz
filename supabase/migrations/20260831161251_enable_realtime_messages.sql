-- Without this, postgres_changes subscriptions on messages never fire —
-- RLS still applies on top (Realtime respects the table's SELECT policy).
alter publication supabase_realtime add table public.messages;
