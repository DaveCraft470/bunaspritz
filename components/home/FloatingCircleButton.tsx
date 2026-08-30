import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { glassButton, shadows } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const SIZE = 52;

export function FloatingCircleButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, shadows.soft, { borderColor: glassButton.border }]}
    >
      <GlassSurface />
      <Ionicons name={icon} size={22} color={glassButton.icon} />
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
