import { PublicUser } from '@/contexts/auth';

// Mirrors the server-side is_admin() SQL function exactly — this is only a
// UI gate (hides/shows admin screens); the actual authorization for
// destructive actions like admin_delete_event() is re-checked server-side,
// since a client-only check can't stop a direct RPC call from a non-admin.
// Checked by username string (not a stored role/id) so it survives an
// account delete + recreate under the same handle.
const ADMIN_USERNAMES = ['david', 'raul'];

export function isAdminAccessEnabled(user: PublicUser | null): boolean {
  return user !== null && ADMIN_USERNAMES.includes(user.username.toLowerCase());
}
