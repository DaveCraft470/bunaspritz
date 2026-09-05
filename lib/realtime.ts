import { supabase } from '@/lib/supabase';

// supabase-js's `.channel(topic)` returns the existing channel object if one
// with that topic is already registered on the client, instead of creating a
// new one — and calling `.on()` on a channel that's already `.subscribe()`d
// throws "cannot add postgres_changes callbacks ... after subscribe()".
//
// That collision is easy to hit on a fast remount (e.g. React reconnecting
// passive effects when a frozen screen becomes visible again): the previous
// mount's cleanup calls `removeChannel`, which unsubscribes asynchronously
// and only drops the channel from the client's registry once that resolves,
// so the new mount's `.channel(topic)` call can still find it mid-teardown.
//
// Evicting any stale channel for the topic before creating a fresh one keeps
// topic names stable (no leaked entries piling up if a prior unsubscribe
// ever hangs) while still avoiding the crash.
export function freshChannel(topic: string) {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) {
    stale.unsubscribe();
    stale.teardown();
  }
  return supabase.channel(topic);
}
