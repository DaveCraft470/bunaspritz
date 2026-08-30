import { Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { colors, glassButton, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const SIZE = 68; // noticeably bigger than the 54px profile/messages nav islands
const IMAGE_WIDTH = 30;
const IMAGE_HEIGHT = 52;

export function HomeBottleButton({ active }: { active: boolean }) {
  return (
    <AnimatedPressable
      onPress={() => router.replace('/')}
      hitSlop={10}
      accessibilityLabel="Acasă"
      style={[
        styles.button,
        shadows.soft,
        { borderColor: active ? colors.green500 : glassButton.border, borderWidth: active ? 2 : 1 },
      ]}
    >
      <GlassSurface />
      <Image source={require('@/assets/images/beer-bottle.png')} resizeMode="contain" style={styles.image} />
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
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
});
