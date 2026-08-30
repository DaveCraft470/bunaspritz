import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { FadeInUp } from '@/components/common/FadeInUp';
import { MapboxMap } from './MapboxMap';
import { LogoWordmark } from './LogoWordmark';
import { EventsCaption } from './EventsCaption';
import { FloatingCircleButton } from './FloatingCircleButton';
import { MenuButton } from './MenuButton';

export function MapPlaceholder() {
  const insets = useSafeAreaInsets();
  const { scheme, colors: theme } = useAppTheme();
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [scheme, fade]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.mapBase, opacity: fade }]}>
      <MapboxMap />

      <FadeInUp style={[styles.headerCluster, { top: insets.top + spacing.md }]}>
        <LogoWordmark />
        <View style={{ height: spacing.sm }} />
        <EventsCaption>12 evenimente azi</EventsCaption>
      </FadeInUp>

      <FadeInUp delay={80} style={[styles.themeToggle, { top: insets.top + spacing.md + 44 }]}>
        <MenuButton />
      </FadeInUp>

      <FadeInUp delay={140} style={[styles.bottomLeft, { bottom: insets.bottom + 96 }]}>
        <FloatingCircleButton icon="search-outline" />
      </FadeInUp>
      <FadeInUp delay={200} style={[styles.bottomRight, { bottom: insets.bottom + 96 }]}>
        <FloatingCircleButton icon="navigate-outline" />
      </FadeInUp>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  headerCluster: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  themeToggle: {
    position: 'absolute',
    right: spacing.lg,
  },
  bottomLeft: {
    position: 'absolute',
    left: spacing.lg,
  },
  bottomRight: {
    position: 'absolute',
    right: spacing.lg,
  },
});
