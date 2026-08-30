import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

type DevFlagsContextValue = {
  hostVerified: boolean;
  setHostVerified: (value: boolean) => void;
};

const DevFlagsContext = createContext<DevFlagsContextValue | null>(null);

export function DevFlagsProvider({ children }: PropsWithChildren) {
  const [hostVerified, setHostVerified] = useState(false);

  const value = useMemo<DevFlagsContextValue>(
    () => ({ hostVerified, setHostVerified }),
    [hostVerified]
  );

  return <DevFlagsContext.Provider value={value}>{children}</DevFlagsContext.Provider>;
}

export function useDevFlags() {
  const ctx = useContext(DevFlagsContext);
  if (!ctx) {
    throw new Error('useDevFlags must be used within a DevFlagsProvider');
  }
  return ctx;
}
