-- Runs the zilesinopti.ro scraper (supabase/functions/scrape-zilesinopti) on
-- a schedule via pg_cron + pg_net, instead of relying on anything client-side
-- (nobody's phone should be responsible for "check the website every so often").
--
-- The shared secret the function checks (CRON_SECRET) is deliberately NOT
-- embedded in this migration file — migrations are committed to git. It's
-- read here from Supabase Vault instead. One-time manual setup after this
-- migration is applied (run once in the SQL editor, never committed):
--
--   select vault.create_secret('<a random secret you generate>', 'scrape_cron_secret');
--
-- ...and set the SAME value as the edge function's own secret:
--
--   supabase secrets set CRON_SECRET=<the same random secret> GEMINI_API_KEY=<the Gemini key>
--
-- Until that secret exists in the vault, the cron job's http call has no
-- header to send and the function (which fails closed with no CRON_SECRET
-- configured) will just 403 — harmless, just means "not wired up yet".
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Re-runnable: dropping migrations forward (a new one editing the schedule)
-- would otherwise collide with "job already exists" on re-apply.
select cron.unschedule(jobid) from cron.job where jobname = 'scrape-zilesinopti';

select cron.schedule(
  'scrape-zilesinopti',
  '17 */3 * * *', -- every 3 hours, offset off the hour to avoid the cron thundering herd
  $$
  select net.http_post(
    url := 'https://bumhqcujuahkbxtxphvr.supabase.co/functions/v1/scrape-zilesinopti',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'scrape_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
