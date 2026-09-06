-- The existing "users update only their own profile" RLS policy is row-level
-- only — it never stopped a client from setting `verified` on their own row
-- directly. Narrowing the UPDATE grant to specific columns closes that at
-- the privilege layer: `verified` can now only change via the service role
-- (didit-webhook, which bypasses grants/RLS entirely), never from the app.
revoke update on public.profiles from authenticated;
grant update (name, username, bio, notify_friends_on_join) on public.profiles to authenticated;
