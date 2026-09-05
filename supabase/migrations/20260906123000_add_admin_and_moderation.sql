-- Admin is currently `__DEV__ && true` on the client (lib/admin.ts) with no
-- server-side role at all — any mutating action a real admin panel needs
-- (suspend, hide, resolve) has to be authorized here, not by trusting that
-- flag, since a client can always lie about __DEV__.

create table public.admin_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

-- Deliberately no select policy for plain authenticated users — whether
-- someone else is an admin isn't public information. is_admin() below
-- (security definer) is how everything else checks this.
create policy "admins can see the admin list"
  on public.admin_roles for select
  using (exists (select 1 from public.admin_roles r where r.user_id = auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- First real admin, so the panel has at least one account that can actually
-- authorize anything once these RPCs are live. Idempotent — safe to re-run.
insert into public.admin_roles (user_id)
select id from auth.users where email = 'remus.mihai1997@gmail.com'
on conflict (user_id) do nothing;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "admins can read the audit log"
  on public.audit_log for select
  using (public.is_admin());

-- No client insert policy — every audit_log row comes from a security
-- definer RPC (this migration's admin_* functions, plus kick_event_participant
-- and block_user added elsewhere), never a direct client write.

alter table public.profiles add column suspended boolean not null default false;
-- Deliberately no `grant update (suspended)` — it only ever changes through
-- admin_suspend_user/admin_unsuspend_user below, same lockdown idiom as
-- `verified`.

alter table public.events
  add column status text not null default 'active'
    check (status in ('active', 'cancelled', 'completed', 'hidden'));

-- The host's own "hosts manage their own events" UPDATE policy is row-level
-- only (host_id = auth.uid()), so without this trigger a host could set
-- status = 'hidden' on their own event to fake a moderation outcome, or flip
-- it back from 'hidden' after an admin set it. 'hidden' is reserved for
-- admin_hide_event/admin_unhide_event (security definer, bypasses RLS but
-- NOT triggers); hosts keep the ability to set 'active'/'cancelled'/
-- 'completed' themselves.
create or replace function public.enforce_event_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'hidden' or old.status = 'hidden') and new.status <> old.status and not public.is_admin() then
    raise exception 'only an admin can hide or unhide an event';
  end if;
  return new;
end;
$$;

create trigger events_status_transition
  before update of status on public.events
  for each row execute function public.enforce_event_status_transition();

create or replace function public.admin_suspend_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles set suspended = true where id = p_user_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'suspend_user', 'user', p_user_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_unsuspend_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles set suspended = false where id = p_user_id;

  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'unsuspend_user', 'user', p_user_id);
end;
$$;

create or replace function public.admin_hide_event(p_event_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.events set status = 'hidden' where id = p_event_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'hide_event', 'event', p_event_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_unhide_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.events set status = 'active' where id = p_event_id and status = 'hidden';

  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'unhide_event', 'event', p_event_id);
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status text)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reports;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('reviewing', 'resolved', 'rejected') then
    raise exception 'invalid status';
  end if;

  update public.reports
    set status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_report_id
    returning * into v_row;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'resolve_report', 'report', p_report_id, jsonb_build_object('status', p_status));

  return v_row;
end;
$$;

grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid) to authenticated;
grant execute on function public.admin_hide_event(uuid, text) to authenticated;
grant execute on function public.admin_unhide_event(uuid) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

-- Reports: admins can now see and the RPC above can now update every report,
-- not just the reporter's own (added here, not in add_reports.sql, since
-- is_admin() didn't exist yet at that point).
create policy "admins can see all reports"
  on public.reports for select
  using (public.is_admin());

-- events: hosts already have their own update policy for the fields they
-- own; admin_hide_event/admin_unhide_event bypass RLS entirely via security
-- definer, so no additional events policy is needed for admin writes.
