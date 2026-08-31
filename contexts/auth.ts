import AsyncStorage from '@react-native-async-storage/async-storage';

// No backend yet — accounts are persisted locally in AsyncStorage as a
// stand-in. Passwords are kept in plain text here only because this is a
// local mock store with nothing to send them to; this must not survive
// into a build that talks to a real backend.

export const AUTH_KEY = 'bunaspritz_authenticated';
const USERS_KEY = 'bunaspritz_users';
const CURRENT_USER_KEY = 'bunaspritz_current_user_email';

const DEFAULT_BIO = 'Ieșiri bune, oameni faini și seri de ținut minte. ✨';

export type StoredUser = {
  name: string;
  username: string;
  email: string;
  password: string;
  bio: string;
};

export type PublicUser = Omit<StoredUser, 'password'>;

type AuthResult = { ok: true } | { ok: false; error: string };

async function readUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublicUser(user: StoredUser): PublicUser {
  const { password, ...publicUser } = user;
  return publicUser;
}

export async function registerUser(
  name: string,
  username: string,
  email: string,
  password: string
): Promise<AuthResult> {
  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    return { ok: false, error: 'Există deja un cont cu acest email.' };
  }

  if (users.some((user) => user.username === normalizedUsername)) {
    return { ok: false, error: 'Acest username este deja folosit.' };
  }

  users.push({
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    password,
    bio: DEFAULT_BIO,
  });
  await writeUsers(users);
  await AsyncStorage.setItem(CURRENT_USER_KEY, normalizedEmail);
  return { ok: true };
}

export async function logInUser(email: string, password: string): Promise<AuthResult> {
  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);

  if (!user || user.password !== password) {
    return { ok: false, error: 'Email sau parolă incorectă.' };
  }

  await AsyncStorage.setItem(CURRENT_USER_KEY, normalizedEmail);
  await AsyncStorage.setItem(AUTH_KEY, 'true');
  return { ok: true };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const email = await AsyncStorage.getItem(CURRENT_USER_KEY);
  if (!email) return null;

  const users = await readUsers();
  const user = users.find((candidate) => candidate.email === email);
  return user ? toPublicUser(user) : null;
}

export async function updateCurrentUser(
  fields: Partial<Pick<StoredUser, 'name' | 'username' | 'bio'>>
): Promise<AuthResult> {
  const email = await AsyncStorage.getItem(CURRENT_USER_KEY);
  if (!email) {
    return { ok: false, error: 'Niciun cont conectat.' };
  }

  const users = await readUsers();
  const index = users.findIndex((candidate) => candidate.email === email);
  if (index === -1) {
    return { ok: false, error: 'Niciun cont conectat.' };
  }

  if (fields.username) {
    const normalizedUsername = fields.username.trim().toLowerCase();
    if (users.some((candidate, i) => i !== index && candidate.username === normalizedUsername)) {
      return { ok: false, error: 'Acest username este deja folosit.' };
    }
    fields = { ...fields, username: normalizedUsername };
  }

  users[index] = { ...users[index], ...fields };
  await writeUsers(users);
  return { ok: true };
}

// Called once the post-signup verification step finishes.
export async function completeSignup(): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, 'true');
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}

// Bypass for the login screen, for the current pre-release phase only —
// remove this (and its button in app/auth.tsx) before a real production
// release, since it skips auth with no server-side gate at all.
export async function devSkipAuth(): Promise<void> {
  const users = await readUsers();
  const devEmail = 'dev@bunaspritz.local';

  if (!users.some((user) => user.email === devEmail)) {
    users.push({
      name: 'Dev User',
      username: 'dev',
      email: devEmail,
      password: '',
      bio: DEFAULT_BIO,
    });
    await writeUsers(users);
  }

  await AsyncStorage.setItem(CURRENT_USER_KEY, devEmail);
  await AsyncStorage.setItem(AUTH_KEY, 'true');
}
