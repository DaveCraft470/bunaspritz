import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  instagram_handle: string | null;
  verified: boolean;
}

const PROFILE_COLUMNS = 'id, name, username, bio, avatar_url, instagram_handle, verified';

export async function searchProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const trimmed = query.trim().replace(/[,()]/g, '');
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .or(`name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
    .neq('id', excludeId)
    .limit(20);

  if (error) return [];
  return data;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single();
  if (error) return null;
  return data;
}

export async function getProfiles(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', ids);
  if (error) return [];
  return data;
}

export type FriendPrefs = {
  mute_messages: boolean;
  mute_activity: boolean;
  hide_activity_from: boolean;
  blocked: boolean;
};

const DEFAULT_PREFS: FriendPrefs = { mute_messages: false, mute_activity: false, hide_activity_from: false, blocked: false };

// owner acting on subject — see supabase/migrations for the exact semantics
// of each field.
export async function getFriendPrefs(ownerId: string, subjectId: string): Promise<FriendPrefs> {
  const { data } = await supabase
    .from('friend_prefs')
    .select('mute_messages, mute_activity, hide_activity_from, blocked')
    .eq('owner_id', ownerId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  return data ?? DEFAULT_PREFS;
}

export async function setFriendPrefs(ownerId: string, subjectId: string, patch: Partial<FriendPrefs>): Promise<boolean> {
  const { error } = await supabase
    .from('friend_prefs')
    .upsert({ owner_id: ownerId, subject_id: subjectId, ...patch }, { onConflict: 'owner_id,subject_id' });
  return !error;
}

// Blocking has to sever any friendship/pending request in both directions,
// which the blocker can't do unilaterally under normal RLS. block_user()/
// unblock_user() run server-side to do that; see supabase/migrations for the
// exact mechanics.
export async function blockUser(subjectId: string): Promise<boolean> {
  const { error } = await supabase.rpc('block_user', { p_subject: subjectId });
  return !error;
}

export async function unblockUser(subjectId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unblock_user', { p_subject: subjectId });
  return !error;
}

export async function getBlockedProfiles(ownerId: string): Promise<Profile[]> {
  const { data } = await supabase.from('friend_prefs').select('subject_id').eq('owner_id', ownerId).eq('blocked', true);
  const ids = (data ?? []).map((row) => row.subject_id);
  return getProfiles(ids);
}

// Blocked either direction — someone who blocked me can't be followed
// anyway (RLS rejects it), so exclude them from the random fallback too.
export async function getBlockedIds(myId: string): Promise<string[]> {
  const { data } = await supabase.from('friend_prefs').select('subject_id').eq('owner_id', myId).eq('blocked', true);
  return (data ?? []).map((row) => row.subject_id);
}

export type SuggestionReason = 'mutual' | 'event';

export type SuggestedProfile = Profile & { reason: SuggestionReason; score: number };

// Friends-of-friends and co-attendees — both require seeing follow/attendance
// rows the caller isn't part of, which RLS won't allow from the client, so
// this always goes through the suggest_friends() RPC (traverses from
// auth.uid() server-side). Never surfaces an error to the caller: a failed
// RPC should just mean "no suggestions", not a broken screen.
export async function getSuggestedFriends(limit = 10): Promise<SuggestedProfile[]> {
  const { data, error } = await supabase.rpc('suggest_friends', { p_limit: limit });
  if (error || !data) return [];
  return data as SuggestedProfile[];
}

// Fallback when there are no graph-based suggestions yet (new account, no
// mutual connections, no shared events): a shuffled page of other people
// with an account, minus anyone already followed/blocked.
export type CommonEvent = { eventId: string; title: string; startsAt: string | null };

// "You both attended N events" — via the get_common_events() RPC (security
// definer, see the migration), since RLS otherwise only lets you read your
// own event_attendees rows directly.
export async function getCommonEvents(otherId: string): Promise<CommonEvent[]> {
  const { data, error } = await supabase.rpc('get_common_events', { p_other_id: otherId });
  if (error || !data) return [];
  return (data as { event_id: string; title: string; starts_at: string | null }[]).map((row) => ({
    eventId: row.event_id,
    title: row.title,
    startsAt: row.starts_at,
  }));
}

// "N of your friends are going" per event, for the recommendation engine
// (lib/recommendations.ts) — via the get_friend_attending_counts() RPC,
// since RLS can't answer a batched cross-event friend-attendance query from
// the client directly.
export async function getFriendAttendingCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_friend_attending_counts');
  if (error || !data) return new Map();
  return new Map((data as { event_id: string; friend_count: number }[]).map((row) => [row.event_id, row.friend_count]));
}

export async function getRandomProfiles(excludeId: string, excludeIds: string[], limit = 10): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).neq('id', excludeId).limit(50);
  if (error || !data) return [];

  const excluded = new Set(excludeIds);
  const filtered = data.filter((profile) => !excluded.has(profile.id));

  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered.slice(0, limit);
}
