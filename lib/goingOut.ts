import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

// "Cine iese?" — a temporary status a user broadcasts to friends ("Ies în
// seara asta 🎉"), auto-expiring by timestamp (see the migration: every
// reader filters expires_at > now(), no cleanup job needed).
export type GoingOutStatus = { userId: string; expiresAt: string };

const DEFAULT_DURATION_HOURS = 6;

export async function getMyGoingOutStatus(userId: string): Promise<GoingOutStatus | null> {
  const { data } = await supabase
    .from('going_out_status')
    .select('user_id, expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, expiresAt: data.expires_at };
}

export async function setGoingOut(userId: string, hours = DEFAULT_DURATION_HOURS): Promise<boolean> {
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('going_out_status')
    .upsert({ user_id: userId, expires_at: expiresAt }, { onConflict: 'user_id' });
  return !error;
}

export async function clearGoingOut(userId: string): Promise<boolean> {
  const { error } = await supabase.from('going_out_status').delete().eq('user_id', userId);
  return !error;
}

// Which of these friend ids currently have an active (non-expired) status —
// used to badge the friends list. Batched (one query for everyone) rather
// than one round-trip per friend row.
export async function getActiveGoingOutIds(friendIds: string[]): Promise<Set<string>> {
  if (!friendIds.length) return new Set();
  const { data } = await supabase
    .from('going_out_status')
    .select('user_id')
    .in('user_id', friendIds)
    .gt('expires_at', new Date().toISOString());
  return new Set((data ?? []).map((row) => row.user_id));
}

export function subscribeToGoingOut(onChange: () => void) {
  const channel = freshChannel('going-out-status')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'going_out_status' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
