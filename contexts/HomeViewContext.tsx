import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

// The home route ('/') has its own internal map/calendar toggle (see
// app/index.tsx) that doesn't change the URL, so the floating nav's home
// button can't tell those two states apart from `pathname` alone — without
// this, pressing home while the calendar is open did nothing (it thought it
// was "already home").
type HomeViewContextValue = {
  showingMap: boolean;
  setShowingMap: (showingMap: boolean) => void;
};

const HomeViewContext = createContext<HomeViewContextValue | null>(null);

export function HomeViewProvider({ children }: PropsWithChildren) {
  const [showingMap, setShowingMap] = useState(true);

  const value = useMemo<HomeViewContextValue>(() => ({ showingMap, setShowingMap }), [showingMap]);

  return <HomeViewContext.Provider value={value}>{children}</HomeViewContext.Provider>;
}

export function useHomeView() {
  const ctx = useContext(HomeViewContext);
  if (!ctx) {
    throw new Error('useHomeView must be used within a HomeViewProvider');
  }
  return ctx;
}
