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

export type FollowStatus = { iFollow: boolean; followsMe: boolean; mutual: boolean };

export async function getFollowStatus(myId: string, otherId: string): Promise<FollowStatus> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id, followee_id')
    .or(`and(follower_id.eq.${myId},followee_id.eq.${otherId}),and(follower_id.eq.${otherId},followee_id.eq.${myId})`);

  const iFollow = !!data?.some((row) => row.follower_id === myId);
  const followsMe = !!data?.some((row) => row.follower_id === otherId);
  return { iFollow, followsMe, mutual: iFollow && followsMe };
}

// Same result as calling getFollowStatus once per id, but as 2 queries
// total instead of up to 2*N — search.tsx was firing one getFollowStatus
// per search result (up to 20 individual round-trips per debounced
// keystroke).
export async function getFollowStatuses(myId: string, otherIds: string[]): Promise<Record<string, FollowStatus>> {
  const result: Record<string, FollowStatus> = {};
  if (!otherIds.length) return result;

  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('follows').select('followee_id').eq('follower_id', myId).in('followee_id', otherIds),
    supabase.from('follows').select('follower_id').eq('followee_id', myId).in('follower_id', otherIds),
  ]);

  const iFollowSet = new Set((following ?? []).map((row) => row.followee_id));
  const followsMeSet = new Set((followers ?? []).map((row) => row.follower_id));

  for (const id of otherIds) {
    const iFollow = iFollowSet.has(id);
    const followsMe = followsMeSet.has(id);
    result[id] = { iFollow, followsMe, mutual: iFollow && followsMe };
  }
  return result;
}

export async function follow(myId: string, otherId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').insert({ follower_id: myId, followee_id: otherId });
  if (error) return false;

  // Best-effort — a failed push shouldn't undo an already-recorded follow.
  supabase.functions.invoke('notify-follow', { body: { followeeId: otherId } }).catch(() => {});

  return true;
}

export async function unfollow(myId: string, otherId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').delete().eq('follower_id', myId).eq('followee_id', otherId);
  return !error;
}

// Everyone you follow who also follows you back.
export async function getMutualFriends(myId: string): Promise<Profile[]> {
  const { data: following } = await supabase.from('follows').select('followee_id').eq('follower_id', myId);
  const followingIds = (following ?? []).map((row) => row.followee_id);
  if (!followingIds.length) return [];

  const { data: mutualEdges } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', myId)
    .in('follower_id', followingIds);
  const mutualIds = (mutualEdges ?? []).map((row) => row.follower_id);
  if (!mutualIds.length) return [];

  const { data: profiles } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', mutualIds);
  return profiles ?? [];
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

// Blocking has to sever the follow edge in both directions, which the
// blocker can't do unilaterally under normal RLS (you can only delete your
// own follow row). block_user()/unblock_user() run server-side to do that;
// see supabase/migrations for the exact mechanics.
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

export async function getFollowingIds(myId: string): Promise<string[]> {
  const { data } = await supabase.from('follows').select('followee_id').eq('follower_id', myId);
  return (data ?? []).map((row) => row.followee_id);
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
