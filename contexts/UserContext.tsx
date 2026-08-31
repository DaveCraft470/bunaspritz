import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
  PublicUser,
  completeSignup,
  devSkipAuth,
  getCurrentUser,
  logInUser,
  registerUser,
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
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  // authenticated = has a session AND has completed the post-signup
  // face-photo step — a session alone isn't enough (see contexts/auth.ts).
  async function refresh() {
    const profile = await getCurrentUser();
    setUser(profile);
    setAuthenticated(profile?.verified ?? false);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

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
          setAuthenticated(result.verified);
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
