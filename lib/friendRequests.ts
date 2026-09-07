import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { getProfiles, type Profile } from '@/lib/social';

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  status: FriendRequestStatus;
};

export type RelationshipStatus = 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends';

type OperationResult = { ok: true; request?: FriendRequest } | { ok: false; error: string };

type DbFriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
};

function fromDb(row: DbFriendRequest): FriendRequest {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    createdAt: row.created_at,
    status: row.status,
  };
}

function pairFilter(myId: string, otherId: string) {
  return `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`;
}

export async function getFriendRequestStatus(myId: string, otherId: string): Promise<RelationshipStatus> {
  if (!myId || !otherId || myId === otherId) return 'none';

  const { data: friends } = await supabase.rpc('are_friends', { a: myId, b: otherId });
  if (friends) return 'friends';

  const { data: pending } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .or(pairFilter(myId, otherId))
    .eq('status', 'pending')
    .limit(1);

  const row = pending?.[0];
  if (!row) return 'none';
  return row.sender_id === myId ? 'outgoing_pending' : 'incoming_pending';
}

// Batched version of getFriendRequestStatus for a list of people (e.g. search
// results) — 2 queries total instead of one round-trip per person.
export async function getFriendRequestStatuses(
  myId: string,
  otherIds: string[],
): Promise<Record<string, RelationshipStatus>> {
  const result: Record<string, RelationshipStatus> = {};
  if (!otherIds.length) return result;
  otherIds.forEach((id) => (result[id] = 'none'));

  const [{ data: friendships }, { data: pendingRequests }] = await Promise.all([
    supabase.from('friendships').select('user_a, user_b'),
    supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('status', 'pending')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`),
  ]);

  const friendIds = new Set(
    (friendships ?? [])
      .filter((row) => row.user_a === myId || row.user_b === myId)
      .map((row) => (row.user_a === myId ? row.user_b : row.user_a)),
  );
  (pendingRequests ?? []).forEach((row) => {
    const otherId = row.sender_id === myId ? row.receiver_id : row.sender_id;
    if (!(otherId in result)) return;
    result[otherId] = row.sender_id === myId ? 'outgoing_pending' : 'incoming_pending';
  });
  otherIds.forEach((id) => {
    if (friendIds.has(id)) result[id] = 'friends';
  });

  return result;
}

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<OperationResult> {
  if (!senderId || !receiverId || senderId === receiverId) {
    return { ok: false, error: 'Nu poți trimite o cerere către propriul profil.' };
  }

  const { data, error } = await supabase.rpc('send_friend_request', { p_receiver_id: receiverId });
  if (error || !data) {
    const message = error?.message.includes('already friends')
      ? 'Sunteți deja prieteni.'
      : 'Nu am putut trimite cererea. Încearcă din nou.';
    return { ok: false, error: message };
  }

  const request = fromDb(data as DbFriendRequest);
  // notify-friend-request inserts the real notifications row itself (it
  // inspects the friend_requests row to pick "new request" vs "accepted"
  // copy) — no client-side notification write needed here.
  supabase.functions.invoke('notify-friend-request', { body: { receiverId } }).catch(() => {});

  return { ok: true, request };
}

export async function acceptFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const { data, error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: 'Cererea nu mai este disponibilă.' };

  const request = fromDb(data as DbFriendRequest);
  // The original sender is the one who should be told their request was
  // accepted — notify-friend-request looks up the row itself, picks the
  // right copy based on its current status, and inserts the real
  // notifications row (no client-side write needed here).
  supabase.functions.invoke('notify-friend-request', { body: { receiverId: request.senderId } }).catch(() => {});

  return { ok: true, request };
}

export async function rejectFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const { data, error } = await supabase.rpc('reject_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: 'Cererea nu mai este disponibilă.' };
  return { ok: true, request: fromDb(data as DbFriendRequest) };
}

export async function cancelFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const { data, error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: 'Cererea nu mai este disponibilă.' };
  return { ok: true, request: fromDb(data as DbFriendRequest) };
}

export async function removeFriend(myId: string, otherId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unfriend', { p_other_id: otherId });
  return !error;
}

export async function getIncomingFriendRequests(myId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', myId)
    .eq('status', 'pending');
  return (data ?? []).map(fromDb);
}

export async function getOutgoingFriendRequests(myId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', myId)
    .eq('status', 'pending');
  return (data ?? []).map(fromDb);
}

export async function getFriends(myId: string): Promise<Profile[]> {
  const { data } = await supabase.from('friendships').select('user_a, user_b').or(`user_a.eq.${myId},user_b.eq.${myId}`);
  const ids = (data ?? []).map((row) => (row.user_a === myId ? row.user_b : row.user_a));
  if (!ids.length) return [];
  return getProfiles(ids);
}

export async function getRequestProfiles(requestsForUser: FriendRequest[]): Promise<Map<string, Profile>> {
  const ids = [...new Set(requestsForUser.flatMap((request) => [request.senderId, request.receiverId]))];
  if (!ids.length) return new Map();
  const remoteProfiles = await getProfiles(ids);
  return new Map(remoteProfiles.map((profile) => [profile.id, profile]));
}

// Realtime updates for both directions — a friend_requests row can change
// because the current user sent it or received it, and postgres_changes only
// supports one `filter` per `.on()` call, so this registers two.
export function subscribeToFriendRequests(myId: string, listener: () => void) {
  const channel = freshChannel(`friend-requests-${myId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${myId}` },
      listener,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${myId}` },
      listener,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
