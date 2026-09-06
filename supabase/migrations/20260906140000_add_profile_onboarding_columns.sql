-- §32: backend storage for onboarding data (preferred genres, city). No
-- onboarding screen exists yet — columns + grants only, same lockdown idiom
-- as instagram_handle/avatar_url: this codebase revokes UPDATE by default
-- and grants per column, so a new client-writable column needs its own
-- grant or writes silently fail at runtime even though the column exists.
alter table public.profiles
  add column city text,
  add column preferences jsonb not null default '[]'::jsonb,
  add constraint profiles_city_length check (city is null or length(city) <= 60);

grant update (city, preferences) on public.profiles to authenticated;
