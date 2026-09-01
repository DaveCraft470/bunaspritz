import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';

// Shown on a profile only when a handle is set — opens the person's
// Instagram profile in the system browser/app.
export function InstagramLink({ handle, style }: { handle: string | null | undefined; style?: object }) {
  const { colors: theme } = useAppTheme();
  const { light } = useHaptics();

  if (!handle) return null;

  return (
    <Pressable
      onPress={() => {
        light();
        Linking.openURL(`https://instagram.com/${handle}`).catch(() => {});
      }}
      style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, style]}
    >
      <Ionicons name="logo-instagram" size={14} color="#E1306C" />
      <Text style={[styles.text, { color: theme.textPrimary }]}>@{handle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 8,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
