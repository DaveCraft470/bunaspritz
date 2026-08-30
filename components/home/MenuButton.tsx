import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { glassButton, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const SIZE = 44;

export function MenuButton() {
  return (
    <AnimatedPressable
      onPress={() => router.push('/settings')}
      hitSlop={10}
      accessibilityLabel="Meniu"
      style={[styles.button, shadows.soft, { borderColor: glassButton.border }]}
    >
      <GlassSurface />
      <Ionicons name="menu-outline" size={22} color={glassButton.icon} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
