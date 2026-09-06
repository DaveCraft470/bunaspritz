-- Optional Instagram handle shown on a profile — just a username, not a
-- full URL (the client normalizes pasted URLs/@-prefixes down to this on
-- save; see contexts/auth.ts).
alter table public.profiles
  add column instagram_handle text,
  add constraint profiles_instagram_handle_length check (instagram_handle is null or length(instagram_handle) <= 30);

grant update (instagram_handle) on public.profiles to authenticated;
