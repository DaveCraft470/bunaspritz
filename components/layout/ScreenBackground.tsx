import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export function ScreenBackground({ children }: PropsWithChildren) {
  const { colors: theme } = useAppTheme();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobLeft]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.green100,
    opacity: 0.5,
    pointerEvents: 'none',
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -90,
    right: -70,
  },
  blobLeft: {
    width: 160,
    height: 160,
    top: 140,
    left: -80,
    backgroundColor: colors.green200,
    opacity: 0.35,
  },
});
