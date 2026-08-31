import { supabase } from '@/lib/supabase';

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  verified: boolean;
  notifyFriendsOnJoin: boolean;
};

type AuthResult = { ok: true } | { ok: false; error: string };
type LoginResult = { ok: true; verified: boolean } | { ok: false; error: string };

function mapAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) return 'Există deja un cont cu acest email.';
  if (/invalid login credentials/i.test(message)) return 'Email sau parolă incorectă.';
  if (/password/i.test(message)) return 'Parola nu îndeplinește cerințele Supabase.';
  return message;
}

async function fetchProfile(userId: string, email: string): Promise<PublicUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, bio, verified, notify_friends_on_join')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    username: data.username,
    bio: data.bio,
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

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', normalizedUsername)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'Acest username este deja folosit.' };
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
  fields: Partial<Pick<PublicUser, 'name' | 'username' | 'bio'>>
): Promise<AuthResult> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, error: 'Niciun cont conectat.' };
  }

  const patch: Record<string, string> = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.bio !== undefined) patch.bio = fields.bio.trim();

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

  await supabase.from('profiles').update({ verified: true }).eq('id', signUp.data.user.id);
}
