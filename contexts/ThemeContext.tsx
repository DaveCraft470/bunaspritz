import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, SchemeColors } from '@/constants/theme';

export type Scheme = 'dark' | 'light';

const STORAGE_KEY = 'spritz.theme.scheme';

type ThemeContextValue = {
  scheme: Scheme;
  colors: SchemeColors;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [scheme, setScheme] = useState<Scheme>('light');

  // Restores whatever the user last picked — defaults to light until this
  // resolves, which the branded splash's own animation comfortably outlasts.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') setScheme(stored);
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      toggleScheme: () => {
        setScheme((s) => {
          const next: Scheme = s === 'dark' ? 'light' : 'dark';
          AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
          return next;
        });
      },
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}
