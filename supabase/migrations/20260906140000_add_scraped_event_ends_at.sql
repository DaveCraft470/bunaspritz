-- Scraped events are no longer restricted to zilesinopti's own "Party"
-- taxonomy tag (see scrape-zilesinopti), so they now include multi-day
-- festivals (e.g. Oktoberfest, which runs for over a week). Gemini's
-- starts_at-only verdict made every such event look "already over" the
-- moment its first day passed, both for the scraper's own skip-if-past check
-- and for the periodic cleanup delete — this column lets both use the actual
-- end of the event instead.
alter table public.events add column ends_at timestamptz;
