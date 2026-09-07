-- Real, server-side admin gating. The client-side check in lib/admin.ts
-- mirrors this exact rule (case-insensitive username in ('david','raul'),
-- no __DEV__ gate) but is_admin() is what actually protects the delete path
-- — a client-only gate can't stop a direct RPC call from a non-admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(username) in ('david', 'raul')
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- events only has a "hosts delete their own events" RLS policy (host_id =
-- auth.uid()), so a plain admin .delete() would silently affect 0 rows.
-- This mirrors lib/events.ts's deleteEvent() cascade behavior (event_attendees
-- and reviews reference events with `on delete cascade`) but checks
-- is_admin() instead of host ownership.
create or replace function public.admin_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.events where id = p_event_id;
end;
$$;

grant execute on function public.admin_delete_event(uuid) to authenticated;
