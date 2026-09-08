import { PublicUser } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';

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

// Admin-only user lookup — a separate query (not lib/social.ts's shared
// Profile/searchProfiles) so `suspended` isn't fetched for every ordinary
// profile read across the app, just this screen.
export type AdminUserRow = {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  verified: boolean;
  suspended: boolean;
};

export async function adminSearchUsers(query: string, excludeId: string): Promise<AdminUserRow[]> {
  const trimmed = query.trim().replace(/[,()]/g, '');
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url, verified, suspended')
    .or(`name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
    .neq('id', excludeId)
    .limit(20);

  if (error) return [];
  return data;
}

// suspended itself has no client UPDATE grant (see the migration) — this is
// the only write path, re-checked against is_admin() server-side.
export async function adminSetSuspended(userId: string, value: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('admin_set_suspended', { p_user_id: userId, p_value: value });
  return !error;
}
