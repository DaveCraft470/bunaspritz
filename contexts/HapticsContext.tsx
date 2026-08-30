import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

type HapticsContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Small tap — nav switches, back buttons, opening a chat/card. */
  light: () => void;
  /** A little more weight — primary CTAs, an animation reaching its payoff. */
  medium: () => void;
};

const HapticsContext = createContext<HapticsContextValue | null>(null);

export function HapticsProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(true);

  const light = useCallback(() => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [enabled]);

  const medium = useCallback(() => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [enabled]);

  const value = useMemo<HapticsContextValue>(
    () => ({ enabled, setEnabled, light, medium }),
    [enabled, light, medium]
  );

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useHaptics() {
  const ctx = useContext(HapticsContext);
  if (!ctx) {
    throw new Error('useHaptics must be used within a HapticsProvider');
  }
  return ctx;
}
