import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';
import { LogoWordmark } from '@/components/home/LogoWordmark';

const HOLD_MS = 900; // lets the staggered letters finish popping in before handing off
const FADE_MS = 220;

// Shown for a brief moment right after the native splash hands off (same
// solid brand green, so there's no flash/flicker at the handoff) — plays the
// wordmark's letter-by-letter entrance, then fades into the real app.
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(onFinish);
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [fade, onFinish]);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <LogoWordmark animated colorOverride={{ primary: '#FFFFFF', accent: '#FF9F5A' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
