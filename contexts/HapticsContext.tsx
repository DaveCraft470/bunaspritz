import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const STORAGE_KEY = 'spritz.haptics.enabled';

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
  const [enabled, setEnabledState] = useState(true);

  // Restores the last saved preference — defaults to on until this resolves.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored !== null) setEnabledState(stored === 'true');
    });
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => {});
  }, []);

  const light = useCallback(() => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [enabled]);

  const medium = useCallback(() => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [enabled]);

  const value = useMemo<HapticsContextValue>(
    () => ({ enabled, setEnabled, light, medium }),
    [enabled, setEnabled, light, medium]
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
