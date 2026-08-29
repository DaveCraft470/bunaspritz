import { Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

const WIDTH = 55;
const HEIGHT = 94;
const LIFT = 16; // sits this much higher than the profile/messages islands

export function HomeBottleButton() {
  return (
    <AnimatedPressable
      onPress={() => router.replace('/')}
      hitSlop={12}
      accessibilityLabel="Acasă"
      style={styles.button}
    >
      <Image
        source={require('@/assets/images/beer-bottle.png')}
        resizeMode="contain"
        style={[styles.image, shadows.soft]}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: WIDTH,
    height: HEIGHT,
    marginBottom: LIFT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  image: {
    width: WIDTH,
    height: HEIGHT,
  },
});
