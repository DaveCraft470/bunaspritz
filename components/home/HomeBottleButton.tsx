import { Image, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';

import { colors, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useHaptics } from '@/contexts/HapticsContext';
import { goToTab } from '@/lib/tabNav';

const SIZE = 68; // noticeably bigger than the 54px profile/messages nav islands
// The source art (beer-bottle-white.png) is a solid white silhouette (flood-
// filled from the original line-art, not just an outline) cropped tight to
// its own bounding box, aspect ~0.322 — sizing this is a direct scale-up
// instead of guessing. 60 * 0.92 = the requested 8% smaller.
const IMAGE_HEIGHT = 60 * 0.92;
const IMAGE_WIDTH = IMAGE_HEIGHT * 0.322;

export function HomeBottleButton({ active }: { active: boolean }) {
  const { light } = useHaptics();
  const pathname = usePathname();
  return (
    <AnimatedPressable
      onPress={() => {
        if (active) return;
        light();
        goToTab(pathname, '/');
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
