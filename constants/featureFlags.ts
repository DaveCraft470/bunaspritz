// Temporary switch for the *join-an-event* identity-verification
// requirement only (see app/event/[id].tsx and app/profile.tsx) while it's
// being iterated on.
//
// Hosting an event is a separate, unconditional gate — it always requires
// effectiveVerified regardless of this flag (see app/new-event.tsx and the
// "verified hosts create their own events" Postgres policy, re-enabled by
// 20260910120000_reenable_verified_host_check.sql), since anyone hosting a
// real-world meetup should be identity-verified even while the join gate is
// still being tuned.
export const VERIFICATION_REQUIRED = false;
