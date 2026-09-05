import { Image, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';

import { colors, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useHaptics } from '@/contexts/HapticsContext';
import { useHomeView } from '@/contexts/HomeViewContext';
import { goToTab } from '@/lib/tabNav';

const SIZE = 68; // noticeably bigger than the 54px profile/messages nav islands
// The source art (beer-bottle-white.png) is a solid white silhouette (flood-
// filled from the original line-art, not just an outline) cropped tight to
// its own bounding box, aspect ~0.322 — sizing this is a direct scale-up
// instead of guessing. 60 * 0.92 = the requested 8% smaller.
const IMAGE_HEIGHT = 60 * 0.92;
const IMAGE_WIDTH = IMAGE_HEIGHT * 0.322;

export function HomeBottleButton() {
  const { light } = useHaptics();
  const pathname = usePathname();
  const { showingMap, setShowingMap } = useHomeView();
  // Being on '/' isn't enough to call this "home" — the public calendar is
  // also '/' (a local view toggle, not its own route, see app/index.tsx), so
  // without the showingMap check this button would look active and do
  // nothing while the calendar was open.
  const active = pathname === '/' && showingMap;
  return (
    <AnimatedPressable
      onPress={() => {
        if (active) return;
        light();
        // Always resets to the map, even when leaving from the calendar view
        // via a different tab (e.g. calendar -> profile -> home) — otherwise
        // dismissAll below would just reveal the still-mounted '/' instance
        // exactly as it was left, calendar and all.
        setShowingMap(true);
        if (pathname !== '/') goToTab(pathname, '/');
      }}
      hitSlop={10}
      accessibilityLabel="Acasă"
      style={[
        styles.button,
        shadows.soft,
        { borderColor: active ? colors.white : 'rgba(255,255,255,0.35)', borderWidth: active ? 2 : 1 },
      ]}
    >
      <Image source={require('@/assets/images/beer-bottle-white.png')} resizeMode="contain" style={styles.image} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green500,
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
});
