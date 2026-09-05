-- registerUser's old pre-signup duplicate-username check ran while the
-- caller was still anonymous, but "profiles are readable by any signed-in
-- user" requires auth.role() = 'authenticated' — so that SELECT was always
-- silently blocked by RLS and never actually caught anything. The real
-- collision only surfaced later as a raw trigger/constraint failure from
-- auth.signUp(). This lets an anonymous caller check availability without
-- opening up read access to the rest of the profiles table.
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where username = lower(check_username)
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
