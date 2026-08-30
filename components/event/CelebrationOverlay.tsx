import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { typography } from '@/constants/theme';
import { useHaptics } from '@/contexts/HapticsContext';

// Two beer mugs slide in from offscreen and meet in the middle, then the
// payoff line fades up — then the whole thing dismisses itself.
export function CelebrationOverlay({ onDone }: { onDone: () => void }) {
  const { medium } = useHaptics();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mugLeftX = useRef(new Animated.Value(-160)).current;
  const mugRightX = useRef(new Animated.Value(160)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(mugLeftX, { toValue: 0, useNativeDriver: true, friction: 5, tension: 60 }),
        Animated.spring(mugRightX, { toValue: 0, useNativeDriver: true, friction: 5, tension: 60 }),
      ]),
    ]).start(() => {
      // Right as the mugs finish sliding in and visually meet.
      medium();
      Animated.sequence([
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(textTranslateY, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
        Animated.delay(1300),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => onDone());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpacity, mugLeftX, mugRightX, textOpacity, textTranslateY, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <Animated.View style={styles.mugRow}>
        {/* Mug emoji art has its handle on the right by default. Mirroring
            the LEFT mug (not the right one) puts both handles on the
            outside, so the glasses meet body-first instead of handle-first. */}
        <Animated.Text style={[styles.mug, { transform: [{ translateX: mugLeftX }, { rotate: '-18deg' }, { scaleX: -1 }] }]}>
          🍺
        </Animated.Text>
        <Animated.Text style={[styles.mug, { transform: [{ translateX: mugRightX }, { rotate: '18deg' }] }]}>
          🍺
        </Animated.Text>
      </Animated.View>
      <Animated.Text
        style={[styles.text, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}
      >
        Ne auzim la Spritz!
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(11,61,32,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  mugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mug: {
    fontSize: 88,
  },
  text: {
    fontFamily: typography.fontFamily.logo,
    color: '#FFFFFF',
    fontSize: 30,
    letterSpacing: -0.2,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
