import { supabase } from '@/lib/supabase';
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

const GENERIC_ERROR = 'A apărut o eroare. Încearcă din nou.';

function fromRow(row: any): FriendRequest {
  return { id: row.id, senderId: row.sender_id, receiverId: row.receiver_id, createdAt: row.created_at, status: row.status };
}

function mapError(error: any): string {
  const message: string = error?.message ?? '';
  if (message.includes('already friends')) return 'Sunteți deja prieteni.';
  if (message.includes('blocked')) return 'Nu poți trimite o cerere acestei persoane.';
  if (message.includes('cannot send a friend request to yourself')) return 'Nu poți trimite o cerere către propriul profil.';
  if (message.includes('no pending')) return 'Cererea nu mai este disponibilă.';
  return GENERIC_ERROR;
}

// ------------------------------------------------------ dev-only overlay ---
// Backend-independent local state for the notifications.tsx dev-tools panel
// (simulateIncomingFriendRequest etc.) — never reaches Supabase, matching
// that panel's own "doesn't reach Supabase" disclaimer. Layered on top of
// the real backend below rather than replacing it.
const localProfiles = new Map<string, Profile>();
const devRequests: FriendRequest[] = [];
const listeners = new Set<() => void>();

function emitDevChange() {
  listeners.forEach((listener) => listener());
}

export function getLocalProfile(id: string): Profile | null {
  return localProfiles.get(id) ?? null;
}

export function registerDevProfile(profile: Profile) {
  localProfiles.set(profile.id, profile);
}

export function ensureDevPeer(myId: string): Profile {
  const id = `dev-peer-${myId}`;
  const existing = localProfiles.get(id);
  if (existing) return existing;
  const profile: Profile = {
    id,
    name: 'Profil de test',
    username: 'profil_test',
    bio: 'Profil local pentru testarea cererilor și notificărilor.',
    avatar_url: null,
    instagram_handle: null,
    verified: false,
    suspended: false,
  };
  localProfiles.set(id, profile);
  return profile;
}

export function simulateIncomingFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = devRequests.find((r) => r.senderId === peer.id && r.receiverId === myId && r.status === 'pending');
  if (existing) return existing;
  const request: FriendRequest = { id: `dev-request-${Date.now()}`, senderId: peer.id, receiverId: myId, createdAt: new Date().toISOString(), status: 'pending' };
  devRequests.push(request);
  emitDevChange();
  return request;
}

export function simulateOutgoingFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = devRequests.find((r) => r.senderId === myId && r.receiverId === peer.id && r.status === 'pending');
  if (existing) return existing;
  const request: FriendRequest = { id: `dev-request-${Date.now()}`, senderId: myId, receiverId: peer.id, createdAt: new Date().toISOString(), status: 'pending' };
  devRequests.push(request);
  emitDevChange();
  return request;
}

export function simulateAcceptedFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = devRequests.find(
    (r) => ((r.senderId === peer.id && r.receiverId === myId) || (r.senderId === myId && r.receiverId === peer.id)) && r.status === 'accepted'
  );
  if (existing) return existing;
  const request: FriendRequest = { id: `dev-request-${Date.now()}`, senderId: peer.id, receiverId: myId, createdAt: new Date().toISOString(), status: 'accepted' };
  devRequests.push(request);
  emitDevChange();
  return request;
}

// ---------------------------------------------------------- real backend ---
export function subscribeToFriendRequests(listener: () => void) {
  listeners.add(listener);
  const channel = supabase
    .channel('friend-requests-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, listener)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, listener)
    .subscribe();
  return () => {
    listeners.delete(listener);
    supabase.removeChannel(channel);
  };
}

export async function getFriendRequestStatus(myId: string, otherId: string): Promise<RelationshipStatus> {
  if (!myId || !otherId || myId === otherId) return 'none';

  const devAccepted = devRequests.find(
    (r) => r.status === 'accepted' && ((r.senderId === myId && r.receiverId === otherId) || (r.senderId === otherId && r.receiverId === myId))
  );
  if (devAccepted) return 'friends';
  const devPending = devRequests.find(
    (r) => r.status === 'pending' && ((r.senderId === myId && r.receiverId === otherId) || (r.senderId === otherId && r.receiverId === myId))
  );
  if (devPending) return devPending.senderId === myId ? 'outgoing_pending' : 'incoming_pending';

  const { data: friendship } = await supabase
    .from('friendships')
    .select('user_a')
    .eq('user_a', myId < otherId ? myId : otherId)
    .eq('user_b', myId < otherId ? otherId : myId)
    .maybeSingle();
  if (friendship) return 'friends';

  const { data: request } = await supabase
    .from('friend_requests')
    .select('sender_id')
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
    .eq('status', 'pending')
    .maybeSingle();
  if (!request) return 'none';
  return request.sender_id === myId ? 'outgoing_pending' : 'incoming_pending';
}

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<OperationResult> {
  if (senderId === receiverId) return { ok: false, error: 'Nu poți trimite o cerere către propriul profil.' };

  const { data, error } = await supabase.rpc('send_friend_request', { p_receiver_id: receiverId });
  if (error || !data) return { ok: false, error: mapError(error) };

  // Best-effort — a failed push/notification shouldn't undo an
  // already-recorded request.
  supabase.functions.invoke('notify-friend-request', { body: { receiverId } }).catch(() => {});

  return { ok: true, request: fromRow(data) };
}

export async function acceptFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const dev = devRequests.find((r) => r.id === requestId && r.receiverId === myId && r.status === 'pending');
  if (dev) {
    dev.status = 'accepted';
    emitDevChange();
    return { ok: true, request: dev };
  }

  const { data, error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: mapError(error) };

  supabase.functions.invoke('notify-friend-request', { body: { receiverId: data.sender_id } }).catch(() => {});
  return { ok: true, request: fromRow(data) };
}

export async function rejectFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const dev = devRequests.find((r) => r.id === requestId && r.receiverId === myId && r.status === 'pending');
  if (dev) {
    dev.status = 'rejected';
    emitDevChange();
    return { ok: true, request: dev };
  }

  const { data, error } = await supabase.rpc('reject_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: mapError(error) };
  return { ok: true, request: fromRow(data) };
}

export async function cancelFriendRequest(myId: string, requestId: string): Promise<OperationResult> {
  const dev = devRequests.find((r) => r.id === requestId && r.senderId === myId && r.status === 'pending');
  if (dev) {
    dev.status = 'cancelled';
    emitDevChange();
    return { ok: true, request: dev };
  }

  const { data, error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
  if (error || !data) return { ok: false, error: mapError(error) };
  return { ok: true, request: fromRow(data) };
}

export async function removeFriend(myId: string, otherId: string): Promise<boolean> {
  const dev = devRequests.find(
    (r) => r.status === 'accepted' && ((r.senderId === myId && r.receiverId === otherId) || (r.senderId === otherId && r.receiverId === myId))
  );
  if (dev) {
    dev.status = 'rejected';
    emitDevChange();
    return true;
  }

  const { error } = await supabase.rpc('unfriend', { p_other_id: otherId });
  return !error;
}

export async function getIncomingFriendRequests(myId: string): Promise<FriendRequest[]> {
  const dev = devRequests.filter((r) => r.receiverId === myId && r.status === 'pending');
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return [...dev, ...(error || !data ? [] : data.map(fromRow))];
}

export async function getOutgoingFriendRequests(myId: string): Promise<FriendRequest[]> {
  const dev = devRequests.filter((r) => r.senderId === myId && r.status === 'pending');
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return [...dev, ...(error || !data ? [] : data.map(fromRow))];
}

export async function getFriends(myId: string): Promise<Profile[]> {
  const devFriendIds = devRequests
    .filter((r) => r.status === 'accepted' && (r.senderId === myId || r.receiverId === myId))
    .map((r) => (r.senderId === myId ? r.receiverId : r.senderId));

  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabase.from('friendships').select('user_b').eq('user_a', myId),
    supabase.from('friendships').select('user_a').eq('user_b', myId),
  ]);
  const remoteIds = [...(asA ?? []).map((r) => r.user_b), ...(asB ?? []).map((r) => r.user_a)];

  const ids = [...new Set([...devFriendIds, ...remoteIds])];
  if (!ids.length) return [];

  const remoteProfiles = await getProfiles(ids);
  const remoteById = new Map(remoteProfiles.map((profile) => [profile.id, profile]));
  return ids.map((id) => remoteById.get(id) ?? localProfiles.get(id)).filter((profile): profile is Profile => !!profile);
}

export async function getRequestProfiles(requestsForUser: FriendRequest[]): Promise<Map<string, Profile>> {
  const ids = [...new Set(requestsForUser.flatMap((request) => [request.senderId, request.receiverId]))];
  if (!ids.length) return new Map();
  const remoteProfiles = await getProfiles(ids);
  const profiles = new Map(remoteProfiles.map((profile) => [profile.id, profile]));
  ids.forEach((id) => {
    const local = localProfiles.get(id);
    if (local) profiles.set(id, local);
  });
  return profiles;
}
