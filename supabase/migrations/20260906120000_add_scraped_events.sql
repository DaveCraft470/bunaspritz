-- Supports events pulled in automatically from https://zilesinopti.ro (the
-- "party + alcohol" scraper, see supabase/functions/scrape-zilesinopti).
-- Those events have no human host, so host_id has to become nullable — the
-- scraper writes with the service role key, which bypasses RLS entirely, so
-- the existing "hosts create/update/delete their own events" policies (all
-- keyed on host_id = auth.uid()) are untouched and still fully enforced for
-- real hosts.
alter table public.events alter column host_id drop not null;

alter table public.events
  add column source text not null default 'host' check (source in ('host', 'scraper')),
  add column source_url text,
  add column external_id text;

-- One row per zilesinopti.ro event slug, so a re-run of the scraper never
-- double-inserts the same event.
create unique index events_external_id_idx on public.events (external_id) where external_id is not null;
create index events_source_idx on public.events (source);

-- Bookkeeping so the scraper doesn't re-fetch + re-ask Gemini about the same
-- non-alcohol "Party" event on every run forever — only alcohol-positive
-- events become rows in `events` itself, so this is where the "already
-- checked, wasn't a match" verdicts live. Service-role only: no policies
-- means RLS (enabled below) denies every anon/authenticated request, which
-- is fine since only the edge function (service role, bypasses RLS) touches it.
create table public.scraped_event_checks (
  external_id text primary key,
  alcohol boolean not null,
  checked_at timestamptz not null default now()
);

alter table public.scraped_event_checks enable row level security;
