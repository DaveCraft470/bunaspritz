import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
};

const PROFILE_COLUMNS = 'id, name, username, bio, avatar_url';

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

export async function follow(myId: string, otherId: string): Promise<void> {
  await supabase.from('follows').insert({ follower_id: myId, followee_id: otherId });
}

export async function unfollow(myId: string, otherId: string): Promise<void> {
  await supabase.from('follows').delete().eq('follower_id', myId).eq('followee_id', otherId);
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
};

const DEFAULT_PREFS: FriendPrefs = { mute_messages: false, mute_activity: false, hide_activity_from: false };

// owner acting on subject — see supabase/migrations for the exact semantics
// of each field.
export async function getFriendPrefs(ownerId: string, subjectId: string): Promise<FriendPrefs> {
  const { data } = await supabase
    .from('friend_prefs')
    .select('mute_messages, mute_activity, hide_activity_from')
    .eq('owner_id', ownerId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  return data ?? DEFAULT_PREFS;
}

export async function setFriendPrefs(ownerId: string, subjectId: string, patch: Partial<FriendPrefs>): Promise<void> {
  await supabase
    .from('friend_prefs')
    .upsert({ owner_id: ownerId, subject_id: subjectId, ...patch }, { onConflict: 'owner_id,subject_id' });
}
