import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, glassButton } from '@/constants/theme';

// Fills its parent with a "liquid glass" look: a diagonal tinted base plus a
// bright sheen across the top, standing in for real blur-behind (which isn't
// reliably available across platforms without extra native wiring). Looks
// the same in both themes — see glassButton in constants/theme.ts.
export function GlassSurface({ active }: { active?: boolean }) {
  return (
    <>
      <LinearGradient
        colors={active ? [colors.green300, colors.green600] : [glassButton.top, glassButton.bottom]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.7 }}
        style={styles.sheen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: '55%',
    borderRadius: 999,
    pointerEvents: 'none',
  },
});
