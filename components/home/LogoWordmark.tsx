import { StyleSheet, Text, View } from 'react-native';

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

export function LogoWordmark() {
  const { scheme, colors: theme } = useAppTheme();
  const chars = TEXT.split('');
  const mid = (chars.length - 1) / 2;
  const shadowColor = scheme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)';

  return (
    <View style={[styles.row, styles.noPointerEvents]}>
      {chars.map((ch, i) => {
        const t = (i - mid) / mid; // -1 (start) .. 1 (end)
        const isAccent = i >= GREEN_FROM;
        const rotate = t * CURVE_ANGLE;
        const translateY = -CURVE_LIFT * (1 - t * t);

        return (
          <Text
            key={i}
            style={[
              styles.char,
              {
                color: isAccent ? theme.logoAccent : theme.logoPrimary,
                textShadowColor: shadowColor,
                marginLeft: i === SPACE_INDEX + 1 ? WORD_GAP : 0,
              },
              { transform: [{ rotate: `${rotate}deg` }, { translateY }] },
            ]}
          >
            {ch}
          </Text>
        );
      })}

      <Text
        style={[
          styles.char,
          styles.question,
          {
            color: theme.logoAccent,
            textShadowColor: shadowColor,
            transform: [
              { rotate: `${QUESTION_TILT}deg` },
              { translateY: QUESTION_DROP },
              { translateX: QUESTION_SHIFT },
              { scale: 1.1 },
            ],
          },
        ]}
      >
        ?
      </Text>
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
