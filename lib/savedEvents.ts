import { supabase } from '@/lib/supabase';

// Saved Events: a plain bookmark table, unlike recently_viewed_events/
// recent_searches — no server-side trimming needed, so ordinary RLS
// (select/insert/delete your own rows) is enough; no RPC required.

export async function isEventSaved(userId: string, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  return !!data;
}

export async function saveEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase.from('saved_events').insert({ user_id: userId, event_id: eventId });
  // A duplicate save (already-bookmarked) hits the PK conflict — treat that
  // as success rather than surfacing an error for an already-true state.
  return !error || error.code === '23505';
}

export async function unsaveEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase.from('saved_events').delete().eq('user_id', userId).eq('event_id', eventId);
  return !error;
}

export async function getSavedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => row.event_id);
}
