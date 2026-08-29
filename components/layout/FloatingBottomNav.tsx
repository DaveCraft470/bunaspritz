import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';
import { FadeInUp } from '@/components/common/FadeInUp';
import { HomeBottleButton } from '@/components/home/HomeBottleButton';

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
        style={[styles.island, active ? shadows.glowGreen : shadows.soft, { borderColor: glassButton.border }]}
      >
        <GlassSurface active={active} />
        <Ionicons name={icon} size={22} color={active ? colors.white : glassButton.iconInactive} />
      </AnimatedPressable>
    </FadeInUp>
  );
}

export function FloatingBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, styles.boxNonePointerEvents, { bottom: insets.bottom + spacing.lg }]}>
      <IconIsland
        route="/profile"
        label="Profil"
        icon="person-outline"
        active={pathname.startsWith('/profile')}
        delay={70}
      />

      <FadeInUp delay={0} distance={10}>
        <HomeBottleButton />
      </FadeInUp>

      <IconIsland
        route="/messages"
        label="Mesaje"
        icon="chatbubble-ellipses-outline"
        active={pathname.startsWith('/messages')}
        delay={140}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boxNonePointerEvents: {
    pointerEvents: 'box-none',
  },
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
