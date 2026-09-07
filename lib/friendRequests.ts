import { getFollowStatus, getMutualFriends, getProfiles, type Profile } from '@/lib/social';
import { createNotification } from '@/lib/notifications';

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

type Listener = () => void;

const requests: FriendRequest[] = [];
const listeners = new Set<Listener>();
const localProfiles = new Map<string, Profile>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToFriendRequests(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocalProfile(id: string): Profile | null {
  return localProfiles.get(id) ?? null;
}

function getPairRequest(myId: string, otherId: string) {
  return requests.find(
    (request) =>
      request.status === 'pending' &&
      ((request.senderId === myId && request.receiverId === otherId) ||
        (request.senderId === otherId && request.receiverId === myId)),
  );
}

function getAcceptedPairRequest(myId: string, otherId: string) {
  return requests.find(
    (request) =>
      request.status === 'accepted' &&
      ((request.senderId === myId && request.receiverId === otherId) ||
        (request.senderId === otherId && request.receiverId === myId)),
  );
}

export async function getFriendRequestStatus(myId: string, otherId: string): Promise<RelationshipStatus> {
  if (!myId || !otherId || myId === otherId) return 'none';
  if (getAcceptedPairRequest(myId, otherId)) return 'friends';

  const pending = getPairRequest(myId, otherId);
  if (pending) return pending.senderId === myId ? 'outgoing_pending' : 'incoming_pending';

  // Legacy compatibility: existing mutual follows remain message-capable friends
  // until the backend has a real friendship table and its RLS policy is migrated.
  const followStatus = await getFollowStatus(myId, otherId);
  return followStatus.mutual ? 'friends' : 'none';
}

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<OperationResult> {
  if (!senderId || !receiverId || senderId === receiverId) {
    return { ok: false, error: 'Nu poți trimite o cerere către propriul profil.' };
  }
  if (getAcceptedPairRequest(senderId, receiverId)) return { ok: false, error: 'Sunteți deja prieteni.' };

  const existing = getPairRequest(senderId, receiverId);
  if (existing) {
    return {
      ok: false,
      error: existing.senderId === senderId ? 'Cererea a fost deja trimisă.' : 'Ai deja o cerere primită de la această persoană.',
    };
  }

  const request: FriendRequest = {
    id: `friend-request-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderId,
    receiverId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  requests.push(request);
  emit();
  createNotification({
    type: 'friend_request',
    actorId: senderId,
    recipientId: receiverId,
    targetId: senderId,
    title: 'Cerere nouă de prietenie',
    body: 'Cineva vrea să fie prieten cu tine.',
  });
  return { ok: true, request };
}

export function acceptFriendRequest(myId: string, requestId: string): OperationResult {
  const request = requests.find((item) => item.id === requestId && item.receiverId === myId && item.status === 'pending');
  if (!request) return { ok: false, error: 'Cererea nu mai este disponibilă.' };

  request.status = 'accepted';
  emit();
  createNotification({
    type: 'friend_request_accepted',
    actorId: myId,
    recipientId: request.senderId,
    targetId: myId,
    title: 'Cererea de prietenie a fost acceptată',
    body: 'Acum sunteți prieteni.',
  });
  return { ok: true, request };
}

export function rejectFriendRequest(myId: string, requestId: string): OperationResult {
  const request = requests.find((item) => item.id === requestId && item.receiverId === myId && item.status === 'pending');
  if (!request) return { ok: false, error: 'Cererea nu mai este disponibilă.' };
  request.status = 'rejected';
  emit();
  return { ok: true, request };
}

export function cancelFriendRequest(myId: string, requestId: string): OperationResult {
  const request = requests.find((item) => item.id === requestId && item.senderId === myId && item.status === 'pending');
  if (!request) return { ok: false, error: 'Cererea nu mai este disponibilă.' };
  request.status = 'cancelled';
  emit();
  return { ok: true, request };
}

export function removeFriend(myId: string, otherId: string): boolean {
  const request = getAcceptedPairRequest(myId, otherId);
  if (!request) return false;
  request.status = 'rejected';
  emit();
  return true;
}

export function getIncomingFriendRequests(myId: string): FriendRequest[] {
  return requests.filter((request) => request.receiverId === myId && request.status === 'pending');
}

export function getOutgoingFriendRequests(myId: string): FriendRequest[] {
  return requests.filter((request) => request.senderId === myId && request.status === 'pending');
}

export async function getFriends(myId: string): Promise<Profile[]> {
  const localFriendIds = requests
    .filter(
      (request) =>
        request.status === 'accepted' && (request.senderId === myId || request.receiverId === myId),
    )
    .map((request) => (request.senderId === myId ? request.receiverId : request.senderId));
  const legacyFriends = await getMutualFriends(myId);
  const legacyIds = legacyFriends.map((profile) => profile.id);
  const ids = [...new Set([...localFriendIds, ...legacyIds])];
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
  };
  localProfiles.set(id, profile);
  return profile;
}

export function simulateIncomingFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = requests.find(
    (request) => request.senderId === peer.id && request.receiverId === myId && request.status === 'pending',
  );
  if (existing) return existing;
  const request: FriendRequest = {
    id: `dev-request-${Date.now()}`,
    senderId: peer.id,
    receiverId: myId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  requests.push(request);
  emit();
  createNotification({
    type: 'friend_request',
    actorId: peer.id,
    recipientId: myId,
    targetId: peer.id,
    title: 'Cerere nouă de prietenie',
    body: 'Profilul de test vrea să fie prieten cu tine.',
  });
  return request;
}

export function simulateOutgoingFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = requests.find(
    (request) => request.senderId === myId && request.receiverId === peer.id && request.status === 'pending',
  );
  if (existing) return existing;
  const request: FriendRequest = {
    id: `dev-request-${Date.now()}`,
    senderId: myId,
    receiverId: peer.id,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  requests.push(request);
  emit();
  return request;
}

export function simulateAcceptedFriendRequest(myId: string): FriendRequest {
  const peer = ensureDevPeer(myId);
  const existing = requests.find(
    (request) =>
      ((request.senderId === peer.id && request.receiverId === myId) ||
        (request.senderId === myId && request.receiverId === peer.id)) &&
      request.status === 'accepted',
  );
  if (existing) return existing;
  const request: FriendRequest = {
    id: `dev-request-${Date.now()}`,
    senderId: peer.id,
    receiverId: myId,
    createdAt: new Date().toISOString(),
    status: 'accepted',
  };
  requests.push(request);
  emit();
  createNotification({
    type: 'friend_request_accepted',
    actorId: peer.id,
    recipientId: myId,
    targetId: peer.id,
    title: 'Cererea de prietenie a fost acceptată',
    body: 'Acum sunteți prieteni.',
  });
  return request;
}
