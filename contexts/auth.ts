import { supabase } from '@/lib/supabase';

const DEV_EMAIL = 'dev@bunaspritz.local';
const DEV_PASSWORD = 'DevSkip!2024';

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

// Called once the post-signup verification step finishes.
export async function completeSignup(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('profiles').update({ verified: true }).eq('id', data.user.id);
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
// release. Still a real, RLS-respecting Supabase session — it just skips
// the credential/verification steps by reusing (or lazily creating) one
// fixed seeded account instead of fabricating local state.
export async function devSkipAuth(): Promise<void> {
  const signIn = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });

  if (signIn.error) {
    const signUp = await supabase.auth.signUp({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      options: { data: { name: 'Dev User', username: 'dev' } },
    });
    if (signUp.error || !signUp.data.user) return;
  }

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from('profiles').update({ verified: true }).eq('id', data.user.id);
  }
}
