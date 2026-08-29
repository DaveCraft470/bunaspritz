import { PropsWithChildren } from 'react';
import { StyleSheet, Text } from 'react-native';

import { typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export function EventsCaption({ children }: PropsWithChildren) {
  const { scheme, colors: theme } = useAppTheme();

  return (
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
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
