import type { Profile } from '@/lib/social';

// Shared __DEV__-only fake profile used by notifications.tsx's dev-tools
// panel to demo notification/event-invitation UI without needing a second
// real account. Not tied to any one feature's backend.
const localProfiles = new Map<string, Profile>();

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
    bio: 'Profil local pentru testarea notificărilor.',
    avatar_url: null,
    instagram_handle: null,
    verified: false,
  };
  localProfiles.set(id, profile);
  return profile;
}
