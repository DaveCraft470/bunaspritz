import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export function EventsCaption({ children }: PropsWithChildren) {
  const { scheme, colors: theme } = useAppTheme();

  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <Text
        style={[
          styles.text,
          {
            color: theme.textSecondary,
            textShadowColor: scheme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)',
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.green500,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
