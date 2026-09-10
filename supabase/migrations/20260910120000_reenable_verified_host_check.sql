-- Re-enables the "verified hosts only" requirement dropped by
-- 20260905190000_temporarily_disable_verified_host_check.sql — Didit KYC is
-- back up (new API key/workflow/webhook secret confirmed working end-to-end
-- 2026-09-10), and the app's create/host UI now gates and explains the same
-- requirement client-side, so nothing should still be creating events
-- through the relaxed policy. Pairs with constants/featureFlags.ts (hosting
-- is now unconditionally gated on effectiveVerified — see new-event.tsx —
-- independent of VERIFICATION_REQUIRED, which still governs the separate
-- join-an-event gate only).
drop policy "hosts create their own events" on public.events;

create policy "verified hosts create their own events"
  on public.events for insert
  with check (
    host_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.verified = true)
  );
