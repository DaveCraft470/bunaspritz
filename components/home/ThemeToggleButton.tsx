import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { glassButton, shadows } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { GlassSurface } from '@/components/common/GlassSurface';

const SIZE = 44;

export function ThemeToggleButton() {
  const { scheme, toggleScheme } = useAppTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [scheme, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AnimatedPressable
      onPress={toggleScheme}
      hitSlop={10}
      accessibilityLabel="Comută tema"
      style={[styles.button, shadows.soft, { borderColor: glassButton.border }]}
    >
      <GlassSurface />
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name={scheme === 'dark' ? 'moon' : 'sunny'} size={20} color={glassButton.icon} />
      </Animated.View>
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
