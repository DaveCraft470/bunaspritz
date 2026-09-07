import { supabase } from '@/lib/supabase';

// Not Interested / Undo Skip — plain RLS (select/insert/delete your own
// rows), same idiom as saved_events. Deleting the row *is* the undo: no
// separate "undo" concept server-side, just re-allow the event through the
// same dismissedIds filter in lib/discovery.ts.

export async function getDismissedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('event_dismissals').select('event_id').eq('user_id', userId);
  if (error) return [];
  return data.map((row) => row.event_id);
}

export async function dismissEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase.from('event_dismissals').insert({ user_id: userId, event_id: eventId });
  return !error || error.code === '23505';
}

export async function undoDismissEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase.from('event_dismissals').delete().eq('user_id', userId).eq('event_id', eventId);
  return !error;
}
