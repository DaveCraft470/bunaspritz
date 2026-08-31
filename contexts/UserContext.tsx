import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/pushTokens';
import {
  PublicUser,
  completeSignup,
  devSkipAuth,
  getCurrentUser,
  logInUser,
  registerUser,
  setNotifyFriendsOnJoin as setNotifyFriendsOnJoinStorage,
  signOut as signOutStorage,
  updateCurrentUser,
} from '@/contexts/auth';

type AuthResult = { ok: true } | { ok: false; error: string };

type UserContextValue = {
  loading: boolean;
  authenticated: boolean;
  user: PublicUser | null;
  signUp: (name: string, username: string, email: string, password: string) => Promise<AuthResult>;
  logIn: (email: string, password: string) => Promise<AuthResult & { verified?: boolean }>;
  completeVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  devSkip: () => Promise<void>;
  updateProfile: (fields: { name?: string; username?: string; bio?: string }) => Promise<AuthResult>;
  setNotifyFriendsOnJoin: (value: boolean) => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

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

  const value = useMemo<UserContextValue>(
    () => ({
      loading,
      authenticated,
      user,
      async signUp(name, username, email, password) {
        const result = await registerUser(name, username, email, password);
        if (result.ok) {
          setUser(await getCurrentUser());
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
      async completeVerification() {
        await completeSignup();
        setUser(await getCurrentUser());
        setAuthenticated(true);
      },
      async signOut() {
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
      async setNotifyFriendsOnJoin(value) {
        await setNotifyFriendsOnJoinStorage(value);
        setUser((current) => (current ? { ...current, notifyFriendsOnJoin: value } : current));
      },
    }),
    [loading, authenticated, user]
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
