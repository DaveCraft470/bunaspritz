import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

type NavVisibilityContextValue = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const NavVisibilityContext = createContext<NavVisibilityContextValue | null>(null);

export function NavVisibilityProvider({ children }: PropsWithChildren) {
  const [hidden, setHidden] = useState(false);

  const value = useMemo<NavVisibilityContextValue>(() => ({ hidden, setHidden }), [hidden]);

  return <NavVisibilityContext.Provider value={value}>{children}</NavVisibilityContext.Provider>;
}

export function useNavVisibility() {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx) {
    throw new Error('useNavVisibility must be used within a NavVisibilityProvider');
  }
  return ctx;
}
