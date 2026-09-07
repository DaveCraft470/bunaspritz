import { supabase } from '@/lib/supabase';

// Recently Viewed / Recently Searched. Both tables have no client insert/
// update RLS policy at all — every write goes through a security-definer RPC
// (record_event_view / record_search, see the migrations) that upserts and
// trims the per-user list to a fixed size in one transaction, so the cap
// can't be bypassed by writing directly to the table.

// Best-effort — a failed view log shouldn't block/alert on viewing an event.
export async function recordEventView(eventId: string): Promise<void> {
  try {
    await supabase.rpc('record_event_view', { p_event_id: eventId });
  } catch {
    // ignore
  }
}

export async function getRecentlyViewedEventIds(userId: string, limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from('recently_viewed_events')
    .select('event_id')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data.map((row) => row.event_id);
}

// Best-effort, same reasoning as recordEventView — search itself already
// happened locally regardless of whether logging it succeeds.
export async function recordSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    await supabase.rpc('record_search', { p_query: trimmed });
  } catch {
    // ignore
  }
}

export async function getRecentSearches(userId: string, limit = 8): Promise<string[]> {
  const { data, error } = await supabase
    .from('recent_searches')
    .select('query')
    .eq('user_id', userId)
    .order('searched_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data.map((row) => row.query);
}

export async function clearRecentSearches(userId: string): Promise<boolean> {
  const { error } = await supabase.from('recent_searches').delete().eq('user_id', userId);
  return !error;
}
