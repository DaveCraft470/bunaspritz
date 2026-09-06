import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  instagramHandle: string | null;
  verified: boolean;
  notifyFriendsOnJoin: boolean;
};

type AuthResult = { ok: true } | { ok: false; error: string };
type LoginResult = { ok: true; verified: boolean } | { ok: false; error: string };

// Accepts a bare username, an @-prefixed one, or a pasted profile URL
// (with or without www/https, trailing slash, query string) and reduces it
// all down to just the handle, matching what's actually stored.
export function normalizeInstagramHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?].*$/, '')
    .toLowerCase();
}

function mapAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) return 'Există deja un cont cu acest email.';
  if (/invalid login credentials/i.test(message)) return 'Email sau parolă incorectă.';
  if (/password/i.test(message)) return 'Parola nu îndeplinește cerințele Supabase.';
  return message;
}

async function fetchProfile(userId: string, email: string): Promise<PublicUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, bio, avatar_url, instagram_handle, verified, notify_friends_on_join')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    username: data.username,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    instagramHandle: data.instagram_handle,
    verified: data.verified,
    notifyFriendsOnJoin: data.notify_friends_on_join,
    email,
  };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return fetchProfile(data.user.id, data.user.email ?? '');
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

export async function registerUser(
  name: string,
  username: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const normalizedUsername = username.trim().toLowerCase();

  // Runs before signUp, while the caller is still anonymous — profiles
  // itself isn't readable pre-auth, so this goes through a security-definer
  // RPC that only ever answers yes/no, never exposing the table.
  const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
    check_username: normalizedUsername,
  });

  if (availabilityError) {
    return { ok: false, error: 'Nu am putut verifica username-ul. Încearcă din nou.' };
  }
  if (!available) {
    return { ok: false, error: 'Acest username este deja folosit. Alege altul.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim(), username: normalizedUsername } },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error.message) };
  }

  if (!data.session) {
    return {
      ok: false,
      error: 'Contul a fost creat, dar necesită confirmare prin email — dezactivează "Confirm email" din Supabase Auth.',
    };
  }

  return { ok: true };
}

export async function logInUser(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error.message) };
  }

  const profile = await fetchProfile(data.user.id, data.user.email ?? '');
  return { ok: true, verified: profile?.verified ?? false };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function updateCurrentUser(
  fields: Partial<Pick<PublicUser, 'name' | 'username' | 'bio'>> & { instagramHandle?: string }
): Promise<AuthResult> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, error: 'Niciun cont conectat.' };
  }

  const patch: Record<string, string | null> = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.bio !== undefined) patch.bio = fields.bio.trim();
  if (fields.instagramHandle !== undefined) {
    const normalized = normalizeInstagramHandle(fields.instagramHandle);
    patch.instagram_handle = normalized || null;
  }

  if (fields.username !== undefined) {
    const normalizedUsername = fields.username.trim().toLowerCase();
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .neq('id', data.user.id)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: 'Acest username este deja folosit.' };
    }
    patch.username = normalizedUsername;
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', data.user.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Uploaded to a fixed per-user path (upsert: true overwrites in place, no
// orphaned old files) in the public 'avatars' bucket, then the profile row
// is pointed at it. A `?v=` cache-buster is appended since the path never
// changes — otherwise the CDN/Image cache would keep serving the old photo.
export async function uploadAvatar(
  localUri: string,
  extension: string,
  contentType: string
): Promise<AuthResult & { avatarUrl?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: 'Niciun cont conectat.' };
  }

  const file = new File(localUri);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'Nu am putut citi imaginea.' };
  }

  // Fixed filename regardless of extension — picking a .png after a .jpg
  // used to leave the old file behind forever (upsert only overwrites an
  // exact key match); the actual served content-type comes from the
  // contentType passed to .upload() below, not from this path's extension.
  const path = `${userData.user.id}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userData.user.id);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, avatarUrl };
}

// The "don't notify friends when I join a Spritz" global toggle from Settings.
export async function setNotifyFriendsOnJoin(value: boolean): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('profiles').update({ notify_friends_on_join: value }).eq('id', data.user.id);
}

// Bypass for the login screen, for the current pre-release phase only —
// remove this (and its button in app/auth.tsx) before a real production
// release. A real, RLS-respecting Supabase session, but backed by a fresh
// throwaway account with a random password generated on-device each tap —
// never a fixed credential, since a fixed one would sit readable in the
// public app bundle/repo and grant anyone a live authenticated session.
export async function devSkipAuth(): Promise<void> {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const email = `dev-${rand}@bunaspritz.local`;
  const password = `${rand}Aa1!`;

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: 'Dev User', username: `dev_${rand.slice(0, 10)}` } },
  });
  if (signUp.error || !signUp.data.user) return;
}
