import { supabase } from '@/lib/supabase';

// Trending — backed by the trending_events() RPC (security definer,
// privacy-safe: returns only event ids + a join count, never identities),
// which ranks by recent join *velocity* rather than total attendee count —
// see the migration for exactly how "recent" and the noise floor are defined.
// Returned in already-ranked order so callers just resolve ids against the
// events already loaded in EventsContext, same idiom as
// getUserJoinedEventIds in lib/events.ts.
export async function getTrendingEventIds(limit = 10): Promise<string[]> {
  const { data, error } = await supabase.rpc('trending_events', { p_hours: 48, p_limit: limit });
  if (error || !data) return [];
  return (data as { event_id: string; recent_joins: number }[]).map((row) => row.event_id);
}
