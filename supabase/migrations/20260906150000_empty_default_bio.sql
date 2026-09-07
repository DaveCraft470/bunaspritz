-- New signups no longer get a canned bio — an empty bio now means "the user
-- chose not to write one", and the UI (app/profile.tsx, app/user/[id].tsx)
-- already renders nothing when bio is empty.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    ''
  );
  return new;
end;
$$;

-- Clear the placeholder bio for existing users who never wrote their own —
-- an exact match only, so anyone who kept/edited real text is untouched.
update public.profiles
set bio = ''
where bio = 'Ieșiri bune, oameni faini și seri de ținut minte. ✨';
