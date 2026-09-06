-- Tracks whether a user has completed the post-signup face-photo step,
-- independent of whether they have a live auth session. Without this,
-- "has a session" and "fully into the app" are the same thing, which would
-- let a fresh signUp() skip straight past app/verification.tsx.
alter table public.profiles add column verified boolean not null default false;
