import { StyleSheet, View } from 'react-native';

import { glassButton } from '@/constants/theme';

// Flat, opaque fill for the floating nav buttons — no gradient/sheen, so it
// reads as a plain solid button regardless of theme (see glassButton in
// constants/theme.ts for why it doesn't repaint itself between schemes).
export function GlassSurface() {
  return <View style={[StyleSheet.absoluteFill, styles.fill]} />;
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: glassButton.top,
  },
});
