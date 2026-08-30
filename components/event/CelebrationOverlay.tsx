import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

// Two beer mugs slide in from offscreen, "clink" with a little scale-punch,
// then the payoff line fades up — then the whole thing dismisses itself.
export function CelebrationOverlay({ onDone }: { onDone: () => void }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mugLeftX = useRef(new Animated.Value(-160)).current;
  const mugRightX = useRef(new Animated.Value(160)).current;
  const impact = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(mugLeftX, { toValue: 0, useNativeDriver: true, friction: 5, tension: 60 }),
        Animated.spring(mugRightX, { toValue: 0, useNativeDriver: true, friction: 5, tension: 60 }),
      ]),
      Animated.sequence([
        Animated.timing(impact, { toValue: 1.35, duration: 90, useNativeDriver: true }),
        Animated.spring(impact, { toValue: 1, useNativeDriver: true, friction: 3 }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.delay(1300),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [overlayOpacity, mugLeftX, mugRightX, impact, textOpacity, textTranslateY, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <Animated.View style={styles.mugRow}>
        <Animated.Text
          style={[styles.mug, { transform: [{ translateX: mugLeftX }, { rotate: '-18deg' }, { scale: impact }] }]}
        >
          🍺
        </Animated.Text>
        <Animated.Text
          style={[styles.mug, { transform: [{ translateX: mugRightX }, { rotate: '18deg' }, { scaleX: -1 }, { scale: impact }] }]}
        >
          🍺
        </Animated.Text>
      </Animated.View>
      <Animated.Text
        style={[styles.text, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}
      >
        Ne auzim la Spritz! 🎉
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
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
