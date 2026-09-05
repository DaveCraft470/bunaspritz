import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  instagram_handle: string | null;
  verified: boolean;
  suspended: boolean;
}

const PROFILE_COLUMNS = 'id, name, username, bio, avatar_url, instagram_handle, verified, suspended';

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

// ==================================================== friend requests =====
// Replaces the old mutual-follow model: "friends" now comes from an
// explicit pending -> accepted request, backed by supabase/migrations'
// friend_requests + friendships tables and their RPCs.

export type FriendshipStatus = {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  requestId: string | null;
};

const NONE_STATUS: FriendshipStatus = { status: 'none', requestId: null };

export async function getFriendshipStatus(myId: string, otherId: string): Promise<FriendshipStatus> {
  const { data: friendship } = await supabase
    .from('friendships')
    .select('user_a')
    .eq('user_a', myId < otherId ? myId : otherId)
    .eq('user_b', myId < otherId ? otherId : myId)
    .maybeSingle();

  if (friendship) return { status: 'friends', requestId: null };

  const { data: request } = await supabase
    .from('friend_requests')
    .select('id, sender_id')
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
    .eq('status', 'pending')
    .maybeSingle();

  if (!request) return NONE_STATUS;
  return { status: request.sender_id === myId ? 'pending_sent' : 'pending_received', requestId: request.id };
}

// Same result as calling getFriendshipStatus once per id, but as 3 queries
// total instead of up to 2*N — mirrors the getFollowStatuses fix this
// replaces (search.tsx fires this once per debounced keystroke for up to 20
// results).
export async function getFriendshipStatuses(myId: string, otherIds: string[]): Promise<Record<string, FriendshipStatus>> {
  const result: Record<string, FriendshipStatus> = {};
  if (!otherIds.length) return result;

  const [{ data: asA }, { data: asB }, { data: requests }] = await Promise.all([
    supabase.from('friendships').select('user_b').eq('user_a', myId).in('user_b', otherIds),
    supabase.from('friendships').select('user_a').eq('user_b', myId).in('user_a', otherIds),
    supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id')
      .eq('status', 'pending')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`),
  ]);

  const friendIds = new Set([...(asA ?? []).map((r) => r.user_b), ...(asB ?? []).map((r) => r.user_a)]);
  const otherIdSet = new Set(otherIds);
  const requestByOther = new Map<string, { id: string; sentByMe: boolean }>();
  for (const r of requests ?? []) {
    const otherId = r.sender_id === myId ? r.receiver_id : r.sender_id;
    if (!otherIdSet.has(otherId)) continue;
    requestByOther.set(otherId, { id: r.id, sentByMe: r.sender_id === myId });
  }

  for (const id of otherIds) {
    if (friendIds.has(id)) {
      result[id] = { status: 'friends', requestId: null };
      continue;
    }
    const pending = requestByOther.get(id);
    result[id] = pending
      ? { status: pending.sentByMe ? 'pending_sent' : 'pending_received', requestId: pending.id }
      : NONE_STATUS;
  }
  return result;
}

// Returns the request's resulting status: 'pending' for a normal request, or
// 'accepted' when the other person already had a pending request to you —
// send_friend_request() auto-accepts that instead of creating a duplicate.
export async function sendFriendRequest(otherId: string): Promise<'pending' | 'accepted' | null> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_receiver_id: otherId });
  if (error || !data) return null;

  // Best-effort — a failed push/notification shouldn't undo an
  // already-recorded request.
  supabase.functions.invoke('notify-friend-request', { body: { receiverId: otherId } }).catch(() => {});

  return data.status as 'pending' | 'accepted';
}

export async function acceptFriendRequest(requestId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
  if (error || !data) return false;

  supabase.functions.invoke('notify-friend-request', { body: { receiverId: data.sender_id } }).catch(() => {});
  return true;
}

export async function rejectFriendRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase.rpc('reject_friend_request', { p_request_id: requestId });
  return !error;
}

export async function cancelFriendRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
  return !error;
}

export async function unfriend(otherId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unfriend', { p_other_id: otherId });
  return !error;
}

export type FriendRequest = {
  id: string;
  createdAt: string;
  profile: Profile;
};

export async function getIncomingRequests(myId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`id, created_at, sender:profiles!friend_requests_sender_id_fkey(${PROFILE_COLUMNS})`)
    .eq('receiver_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map((row) => ({ id: row.id, createdAt: row.created_at, profile: row.sender }));
}

export async function getOutgoingRequests(myId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`id, created_at, receiver:profiles!friend_requests_receiver_id_fkey(${PROFILE_COLUMNS})`)
    .eq('sender_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map((row) => ({ id: row.id, createdAt: row.created_at, profile: row.receiver }));
}

export async function getFriends(myId: string): Promise<Profile[]> {
  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabase.from('friendships').select(`profile:profiles!friendships_user_b_fkey(${PROFILE_COLUMNS})`).eq('user_a', myId),
    supabase.from('friendships').select(`profile:profiles!friendships_user_a_fkey(${PROFILE_COLUMNS})`).eq('user_b', myId),
  ]);

  return [...(asA as any[] ?? []).map((r) => r.profile), ...(asB as any[] ?? []).map((r) => r.profile)];
}

// ============================================================== blocking ===
export async function blockUser(otherId: string): Promise<boolean> {
  const { error } = await supabase.rpc('block_user', { p_target_id: otherId });
  return !error;
}

export async function unblockUser(otherId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unblock_user', { p_target_id: otherId });
  return !error;
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

export async function setFriendPrefs(ownerId: string, subjectId: string, patch: Partial<FriendPrefs>): Promise<boolean> {
  const { error } = await supabase
    .from('friend_prefs')
    .upsert({ owner_id: ownerId, subject_id: subjectId, ...patch }, { onConflict: 'owner_id,subject_id' });
  return !error;
}
