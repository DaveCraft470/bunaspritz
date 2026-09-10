-- Two gaps in this morning's 20260908170000 migration, caught by a security
-- review of that same diff:

-- 1. The reports INSERT policy only pinned reporter_id — status/reviewed_by/
-- reviewed_at were left open, so a client could insert a report that's
-- already 'resolved'/'dismissed' with an arbitrary reviewed_by, forging a
-- fake moderation record and defeating hasActiveReport's duplicate guard
-- (which excludes closed statuses). New reports must start untouched.
drop policy "submit your own reports" on public.reports;

create policy "submit your own reports"
  on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'new' and reviewed_by is null and reviewed_at is null);

-- 2. profiles' SELECT RLS is blanket "any authenticated user" (init
-- migration) — there's no column-level SELECT restriction (unlike the
-- column-level UPDATE grants used for `verified`/`suspended`), and it can't
-- easily gain one: contexts/auth.ts's own-profile fetch needs to read its
-- own `suspended` value to enforce the sign-out-if-suspended check, so a
-- blanket column revoke would break that legitimate read too — column
-- privileges aren't row-scoped. lib/admin.ts's adminSearchUsers() selected
-- `suspended` directly from the base table, which (in addition to being
-- gated only by the client-side admin check) meant any authenticated user
-- could run that same query themselves against an arbitrary profile id and
-- learn whether it's suspended. This RPC re-checks is_admin() server-side
-- for the one legitimate reason to browse *other* users' suspended status.
-- Note: this closes the app's own discovery path, not the underlying
-- table-level exposure — a determined non-admin could still query
-- `suspended` directly via the SDK, same as `verified` already can be. A
-- full fix needs a profiles_public view (excluding suspended) that every
-- "browse other profiles" call site reads from instead of the base table.
create or replace function public.admin_search_users(p_query text)
returns table (id uuid, name text, username text, avatar_url text, verified boolean, suspended boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.name, p.username, p.avatar_url, p.verified, p.suspended
  from public.profiles p
  where p.name ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%'
  limit 20;
end;
$$;

grant execute on function public.admin_search_users(text) to authenticated;
