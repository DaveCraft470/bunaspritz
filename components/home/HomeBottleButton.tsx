import { Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { colors, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

const SIZE = 68; // noticeably bigger than the 54px profile/messages nav islands
// The source art (beer-bottle-white.png) is now cropped tight to the bottle's
// own bounding box (aspect ~0.314), so sizing this to the button is a direct
// scale-up instead of guessing — this is most of the button's diameter with
// just a few px of breathing room top/bottom.
const IMAGE_HEIGHT = 60;
const IMAGE_WIDTH = IMAGE_HEIGHT * 0.314;

export function HomeBottleButton({ active }: { active: boolean }) {
  return (
    <AnimatedPressable
      onPress={() => {
        if (!active) router.replace('/');
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
