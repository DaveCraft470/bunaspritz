import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { darkColors, lightColors, SchemeColors } from '@/constants/theme';

export type Scheme = 'dark' | 'light';

type ThemeContextValue = {
  scheme: Scheme;
  colors: SchemeColors;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [scheme, setScheme] = useState<Scheme>('dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      toggleScheme: () => setScheme((s) => (s === 'dark' ? 'light' : 'dark')),
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
