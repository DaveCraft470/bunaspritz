import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

const TEXT = 'buna, spritz';
const SPACE_INDEX = TEXT.indexOf(' ');
const GREEN_FROM = TEXT.indexOf('spritz');

const CURVE_ANGLE = 5; // deg of arc across the whole word — kept very slight
const CURVE_LIFT = 6; // px the middle characters rise above the ends
const WORD_GAP = 3; // a teeny bit of extra breathing room between "buna," and "spritz"

const QUESTION_TILT = 40; // leans the "?" to the right
const QUESTION_DROP = 12; // and sits it lower than the rest of the word
const QUESTION_SHIFT = 5; // and nudges it a bit further right

const STAGGER_MS = 45;
const POP_DISTANCE = 18;

type ColorOverride = { primary: string; accent: string };

export function LogoWordmark({
  animated = false,
  colorOverride,
}: {
  animated?: boolean;
  colorOverride?: ColorOverride;
}) {
  const { scheme, colors: theme } = useAppTheme();
  const chars = TEXT.split('');
  const mid = (chars.length - 1) / 2;
  const shadowColor = scheme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)';
  const primaryColor = colorOverride?.primary ?? theme.logoPrimary;
  const accentColor = colorOverride?.accent ?? theme.logoAccent;

  // One entrance value per letter plus the trailing "?" — only animated when
  // asked to (the splash screen), so the header usage stays instant as before.
  const entrance = useRef(chars.map(() => new Animated.Value(animated ? 0 : 1))).current;
  const questionEntrance = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.stagger(STAGGER_MS, [
      ...entrance.map((value) =>
        Animated.spring(value, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 })
      ),
      Animated.spring(questionEntrance, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  return (
    <View style={[styles.row, styles.noPointerEvents]}>
      {chars.map((ch, i) => {
        const t = (i - mid) / mid; // -1 (start) .. 1 (end)
        const isAccent = i >= GREEN_FROM;
        const rotate = t * CURVE_ANGLE;
        const curveLift = -CURVE_LIFT * (1 - t * t);
        const popLift = entrance[i].interpolate({ inputRange: [0, 1], outputRange: [POP_DISTANCE, 0] });

        return (
          <Animated.Text
            key={i}
            style={[
              styles.char,
              {
                color: isAccent ? accentColor : primaryColor,
                textShadowColor: shadowColor,
                marginLeft: i === SPACE_INDEX + 1 ? WORD_GAP : 0,
                opacity: entrance[i],
              },
              { transform: [{ rotate: `${rotate}deg` }, { translateY: curveLift }, { translateY: popLift }] },
            ]}
          >
            {ch}
          </Animated.Text>
        );
      })}

      <Animated.Text
        style={[
          styles.char,
          styles.question,
          {
            color: accentColor,
            textShadowColor: shadowColor,
            opacity: questionEntrance,
            transform: [
              { rotate: `${QUESTION_TILT}deg` },
              { translateY: QUESTION_DROP },
              { translateX: QUESTION_SHIFT },
              { scale: 1.1 },
              { translateY: questionEntrance.interpolate({ inputRange: [0, 1], outputRange: [POP_DISTANCE, 0] }) },
            ],
          },
        ]}
      >
        ?
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  char: {
    fontFamily: typography.fontFamily.logo,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.5,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  question: {
    marginLeft: 6,
  },
});
