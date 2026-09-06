-- §29: "Story-urile expirate pot fi filtrate SQL chiar dacă cleanup fizic
-- se face ulterior" — the spec explicitly allows expired-row filtering to
-- stand in for physical cleanup, which every stories query already does via
-- `now() < expires_at`. This just stops expired rows from accumulating
-- forever; it deliberately does NOT delete the underlying storage objects
-- (that needs an edge function with the service role, which needs a
-- project URL/secret that can't be safely hardcoded into a portable
-- migration) — an orphaned-media sweep is a reasonable follow-up, not a
-- blocker, since nothing serves expired stories' media anyway (the storage
-- read policy gates on the still-existing row's expiry). Rows are kept for
-- 7 days past expiry, not deleted immediately, so story_views history isn't
-- wiped the instant a story expires — just bounded from growing forever.
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-expired-stories',
  '0 * * * *',
  $$delete from public.stories where expires_at < now() - interval '7 days'$$
);
