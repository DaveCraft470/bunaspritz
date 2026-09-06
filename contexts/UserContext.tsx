import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { registerForPushNotifications, unregisterPushToken } from '@/lib/pushTokens';
import { freshChannel } from '@/lib/realtime';
import {
  PublicUser,
  confirmPasswordReset as confirmPasswordResetStorage,
  devSkipAuth,
  getCurrentUser,
  logInUser,
  registerUser,
  requestPasswordReset as requestPasswordResetStorage,
  resendSignupCode as resendSignupCodeStorage,
  setNotifyFriendsOnJoin as setNotifyFriendsOnJoinStorage,
  signOut as signOutStorage,
  updateCurrentUser,
  uploadAvatar as uploadAvatarStorage,
  verifySignupCode as verifySignupCodeStorage,
} from '@/contexts/auth';

type AuthResult = { ok: true } | { ok: false; error: string };
type SignUpResult = { ok: true; needsVerification: boolean } | { ok: false; error: string };
type LoginResult =
  | { ok: true; verified: boolean }
  | { ok: false; error: string; needsVerification?: boolean };

type UserContextValue = {
  loading: boolean;
  authenticated: boolean;
  user: PublicUser | null;
  effectiveVerified: boolean;
  signUp: (name: string, username: string, email: string, password: string) => Promise<SignUpResult>;
  logIn: (email: string, password: string) => Promise<LoginResult>;
  verifySignupCode: (email: string, code: string) => Promise<AuthResult>;
  resendSignupCode: (email: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  devSkip: () => Promise<void>;
  updateProfile: (fields: {
    name?: string;
    username?: string;
    bio?: string;
    instagramHandle?: string;
  }) => Promise<AuthResult>;
  uploadAvatar: (localUri: string, extension: string, contentType: string) => Promise<AuthResult>;
  setNotifyFriendsOnJoin: (value: boolean) => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const effectiveVerified = !!user && (__DEV__ || user.verified);

  // authenticated = has a session. Identity verification (user.verified) is
  // a separate, optional gate now — triggered from the profile menu or when
  // joining an event — not a precondition for entering the app at all.
  async function refresh() {
    const profile = await getCurrentUser();
    setUser(profile);
    setAuthenticated(profile !== null);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Register (or refresh) the device's push token once actually authenticated
  // — no point asking for permission before someone's even logged in.
  useEffect(() => {
    if (authenticated && user) {
      registerForPushNotifications(user.id);
    }
  }, [authenticated, user?.id]);

  // Keeps `verified` (and any other profile field) live once Didit's webhook
  // approves a session server-side — the client has no write path to this
  // field itself (see the profiles RLS/column-grant migration), so this
  // subscription is the only way the app finds out without a manual refresh.
  useEffect(() => {
    if (!user) return;

    const channel = freshChannel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo<UserContextValue>(
    () => ({
      loading,
      authenticated,
      user,
      effectiveVerified,
      async signUp(name, username, email, password) {
        const result = await registerUser(name, username, email, password);
        if (result.ok) {
          const profile = await getCurrentUser();
          setUser(profile);
          setAuthenticated(profile !== null);
        }
        return result;
      },
      async logIn(email, password) {
        const result = await logInUser(email, password);
        if (result.ok) {
          setUser(await getCurrentUser());
          setAuthenticated(true);
        }
        return result;
      },
      async verifySignupCode(email, code) {
        const result = await verifySignupCodeStorage(email, code);
        if (result.ok) {
          setUser(await getCurrentUser());
          setAuthenticated(true);
        }
        return result;
      },
      async resendSignupCode(email) {
        return resendSignupCodeStorage(email);
      },
      async requestPasswordReset(email) {
        return requestPasswordResetStorage(email);
      },
      async confirmPasswordReset(email, code, newPassword) {
        const result = await confirmPasswordResetStorage(email, code, newPassword);
        if (result.ok) {
          // verifyOtp's 'recovery' flow leaves the caller signed in with a
          // fresh session — no separate login step needed after this.
          setUser(await getCurrentUser());
          setAuthenticated(true);
        }
        return result;
      },
      async signOut() {
        // Unregister before signing out — the push_tokens RLS policy needs
        // an authenticated session, so this has to run first or it's just
        // silently blocked, leaving the row (and the notifications) behind.
        if (user) await unregisterPushToken(user.id);
        await signOutStorage();
        setAuthenticated(false);
        setUser(null);
      },
      async devSkip() {
        await devSkipAuth();
        setUser(await getCurrentUser());
        setAuthenticated(true);
      },
      async updateProfile(fields) {
        const result = await updateCurrentUser(fields);
        if (result.ok) {
          setUser(await getCurrentUser());
        }
        return result;
      },
      async uploadAvatar(localUri, extension, contentType) {
        const result = await uploadAvatarStorage(localUri, extension, contentType);
        if (result.ok) {
          setUser(await getCurrentUser());
        }
        return result;
      },
      async setNotifyFriendsOnJoin(value) {
        await setNotifyFriendsOnJoinStorage(value);
        setUser((current) => (current ? { ...current, notifyFriendsOnJoin: value } : current));
      },
    }),
    [loading, authenticated, user, effectiveVerified]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
