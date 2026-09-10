-- Two features that only ever existed as client-side mocks (module-level
-- in-memory arrays in lib/reports.ts and app/admin-users.tsx's local state):
-- reporting a user/event/photo, and admin-suspending a user. Neither synced
-- across devices or actually restricted anything server-side.

-- ================================================================ reports ==
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'event', 'event_photo')),
  target_id uuid not null,
  target_label text not null,
  reporter_label text not null,
  reason text not null,
  description text not null default '',
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id)
);

create index reports_reporter_idx on public.reports (reporter_id);
create index reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "submit your own reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- Reporters can see their own reports (ReportModal's duplicate-report check
-- reads this), admins can see everyone's.
create policy "see your own reports, admins see all"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

create policy "admins update report status"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- Without this, postgres_changes subscriptions never fire — same idiom as
-- every other realtime table in this project.
alter publication supabase_realtime add table public.reports;

-- =========================================== profiles.suspended ==
-- Same idiom as `verified` (20260831192550_lock_verified_column.sql): no
-- client UPDATE grant on this column at all, so it can only change via the
-- security-definer RPC below, which re-checks is_admin() server-side.
alter table public.profiles add column suspended boolean not null default false;

create or replace function public.admin_set_suspended(p_user_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles set suspended = p_value where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
