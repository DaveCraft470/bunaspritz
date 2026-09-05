-- lib/reports.ts is currently a module-level array — "nu există în Supabase"
-- per its own dev-seed comment. Real table + RLS; admin-only review access
-- is added once is_admin() exists in the next migration (this one leaves
-- review/update closed to everyone but the reporter's own insert/select,
-- and the admin migration ADDs the reviewer policy rather than this one
-- forward-referencing a function that doesn't exist yet).

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'event')),
  target_id uuid not null,
  reason text not null,
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  check ((status = 'pending') = (reviewed_at is null))
);

create index reports_target_idx on public.reports (target_type, target_id);
create index reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "see your own reports"
  on public.reports for select
  using (reporter_id = auth.uid());

create policy "file a report as yourself"
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- No update/delete for the reporter — a report, once filed, is only ever
-- moved along by admin review (added in the next migration).
