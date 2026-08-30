import { Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { colors, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

const SIZE = 68; // noticeably bigger than the 54px profile/messages nav islands
const IMAGE_WIDTH = 26;
const IMAGE_HEIGHT = 46;

export function HomeBottleButton({ active }: { active: boolean }) {
  return (
    <AnimatedPressable
      onPress={() => router.replace('/')}
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
