-- TEMPORARY — pairs with constants/featureFlags.ts's VERIFICATION_REQUIRED
-- being set to false. Disabling the client-side verification gates alone
-- would leave this policy still rejecting event creation for real
-- unverified users with a raw RLS error, so it's relaxed back to the
-- pre-verification check here too.
--
-- To re-enable enforcement: flip VERIFICATION_REQUIRED back to true AND
-- re-apply 20260901190000_require_verified_host.sql's policy (drop this one,
-- recreate "verified hosts create their own events").
drop policy "verified hosts create their own events" on public.events;

create policy "hosts create their own events"
  on public.events for insert
  with check (host_id = auth.uid());
