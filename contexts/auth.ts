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
type LoginResult =
  | { ok: true; verified: boolean }
  | { ok: false; error: string; needsVerification?: boolean };
type SignUpResult = { ok: true; needsVerification: boolean } | { ok: false; error: string };

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

// Branches on `error.code` (stable, per Supabase) rather than parsing
// `error.message` (free text, can change wording between versions).
function mapAuthError(error: { message: string; code?: string }): string {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Există deja un cont cu acest email.';
    case 'invalid_credentials':
      return 'Email sau parolă incorectă.';
    case 'email_not_confirmed':
      return 'Emailul nu a fost confirmat încă.';
    case 'weak_password':
      return 'Parola nu îndeplinește cerințele Supabase.';
    case 'otp_expired':
      return 'Cod invalid sau expirat.';
    case 'over_email_send_rate_limit':
      return 'Ai cerut prea multe coduri. Așteaptă puțin și încearcă din nou.';
    default:
      return error.message;
  }
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
): Promise<SignUpResult> {
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
    return { ok: false, error: mapAuthError(error) };
  }

  // No session back means Supabase Auth's "Confirm email" setting is on
  // (it is, for this project — see supabase/config.toml) and is waiting on
  // the 6-digit code emailed to them; the caller shows the code-entry step.
  return { ok: true, needsVerification: !data.session };
}

// Completes signup: exchanges the 6-digit code from the confirmation email
// for a session. Supabase treats a right-looking-but-wrong code the same as
// an expired one ('otp_expired') to avoid leaking which case it is.
export async function verifySignupCode(email: string, code: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'signup',
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  if (!data.session) {
    return { ok: false, error: 'Codul nu a putut fi confirmat.' };
  }
  return { ok: true };
}

// Re-sends the signup confirmation email (same 6-digit code mechanism).
export async function resendSignupCode(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  return { ok: true };
}

// Sends the password-reset email, which — per the custom "recovery" template
// pushed to Supabase (see supabase/templates/recovery.html) — shows a
// 6-digit code rather than a magic link, since this app has no universal-link
// / deep-link handling set up to catch a link tap from the email client.
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  return { ok: true };
}

// Exchanges the reset code for a (recovery) session, then immediately uses
// that session to set the new password — the two-step dance Supabase's API
// requires; the caller only sees one "reset" action.
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  if (!data.session) {
    return { ok: false, error: 'Codul nu a putut fi confirmat.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { ok: false, error: mapAuthError(updateError) };
  }
  return { ok: true };
}

export async function logInUser(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error), needsVerification: error.code === 'email_not_confirmed' };
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
// anonymous account generated on-device each tap — never a fixed credential,
// since a fixed one would sit readable in the public app bundle/repo and
// grant anyone a live authenticated session. Anonymous (not a throwaway
// email+password signUp) specifically so this keeps working now that signup
// requires email confirmation — there's no inbox to confirm from here.
export async function devSkipAuth(): Promise<void> {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const signIn = await supabase.auth.signInAnonymously({
    options: { data: { name: 'Dev User', username: `dev_${rand.slice(0, 10)}` } },
  });
  if (signIn.error || !signIn.data.user) return;
}
