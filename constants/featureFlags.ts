// Temporary, whole-app switch to disable the identity-verification
// requirement while it's being iterated on — every client-side gate below
// checks this instead of user.verified directly, and the "verified hosts"
// Postgres policy has a matching temporary migration
// (20260905190000_temporarily_disable_verified_host_check.sql) so real event
// creation isn't blocked server-side while this is off either.
//
// Flip back to true, and revert that migration (re-apply
// 20260901190000_require_verified_host.sql's policy), to re-enable
// enforcement everywhere at once.
export const VERIFICATION_REQUIRED = false;
