import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FadeInUp } from '@/components/common/FadeInUp';
import { HomeBottleButton } from '@/components/home/HomeBottleButton';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';

const ISLAND_SIZE = 54;

function IconIsland({
  route,
  label,
  icon,
  active,
  delay,
}: {
  route: '/profile' | '/messages';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  delay: number;
}) {
  return (
    <FadeInUp delay={delay} distance={10}>
      <AnimatedPressable
        onPress={() => router.replace(route)}
        hitSlop={10}
        accessibilityLabel={label}
        style={[
          styles.island,
          shadows.soft,
          { borderColor: active ? colors.green500 : glassButton.border, borderWidth: active ? 2 : 1 },
        ]}
      >
        <GlassSurface />
        <Ionicons name={icon} size={22} color={active ? colors.green600 : glassButton.iconInactive} />
      </AnimatedPressable>
    </FadeInUp>
  );
}

export function FloatingBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { hidden } = useNavVisibility();
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hiding must be instant — it needs to be gone before the chat it's
    // making room for finishes rendering. Reappearing can ease back in.
    if (hidden) {
      shift.setValue(1);
      return;
    }
    Animated.timing(shift, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hidden, shift]);

  const translateY = shift.interpolate({ inputRange: [0, 1], outputRange: [0, 96] });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + spacing.lg,
          opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={hidden ? 'none' : 'box-none'}
    >
      <IconIsland
        route="/profile"
        label="Profil"
        icon="person-outline"
        active={pathname.startsWith('/profile')}
        delay={70}
      />

      <FadeInUp delay={0} distance={10}>
        <HomeBottleButton active={pathname === '/'} />
      </FadeInUp>

      <IconIsland
        route="/messages"
        label="Mesaje"
        icon="chatbubble-ellipses-outline"
        active={pathname.startsWith('/messages')}
        delay={140}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.huge,
    right: spacing.huge,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  island: {
    width: ISLAND_SIZE,
    height: ISLAND_SIZE,
    borderRadius: ISLAND_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
