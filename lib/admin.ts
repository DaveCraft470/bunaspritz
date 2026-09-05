import { PublicUser } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';

// Development-only switch for *panel visibility* — no admin-invite UI exists
// yet to gate this properly. This is not authorization: every mutating admin
// action below goes through a security-definer RPC that re-checks
// is_admin() server-side (supabase/migrations/..._add_admin_and_moderation.sql),
// so a client that fakes this flag still can't suspend/hide/resolve anything
// without a real admin_roles row.
export const DEV_ADMIN_ACCESS_ENABLED = true;

export function isAdminAccessEnabled(user: PublicUser | null): boolean {
  return __DEV__ && DEV_ADMIN_ACCESS_ENABLED && user !== null;
}

export async function suspendUser(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_suspend_user', { p_user_id: userId });
  return !error;
}

export async function unsuspendUser(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_unsuspend_user', { p_user_id: userId });
  return !error;
}

export async function hideEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_hide_event', { p_event_id: eventId });
  return !error;
}

export async function unhideEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_unhide_event', { p_event_id: eventId });
  return !error;
}
