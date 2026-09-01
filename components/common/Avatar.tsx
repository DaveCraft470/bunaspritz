import { Image, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';

// Shared everywhere a user's picture shows up (edit-profile, both profile
// screens, the messages list) — a real photo when avatarUrl is set, else the
// same colored-circle-with-initial placeholder every screen already used.
export function Avatar({
  uri,
  name,
  size,
  fontSize,
  color,
  style,
}: {
  uri?: string | null;
  name: string;
  size: number;
  fontSize?: number;
  color?: string;
  style?: object;
}) {
  const { colors: theme } = useAppTheme();
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[dimensionStyle, style]} />;
  }

  return (
    <View
      style={[
        styles.fallback,
        dimensionStyle,
        { backgroundColor: color ?? theme.surfaceMuted },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: fontSize ?? size * 0.4, color: color ? '#FFFFFF' : theme.textPrimary }]}>
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '800' },
});
