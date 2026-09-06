import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

export type SafetyAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

// Reusable "⋯ Safety" bottom sheet — Blochează / Raportează / Anulează (plus
// whatever else a screen wants, e.g. friend notification prefs) behind a
// single existing "more options" trigger, instead of one-off menus per card.
export function SafetyMenu({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SafetyAction[];
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {title && <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>{title}</Text>}
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                onClose();
                setTimeout(() => action.onPress(), 0);
              }}
              style={[styles.row, { borderColor: theme.border }]}
              accessibilityLabel={action.label}
            >
              <Ionicons name={action.icon} size={18} color={action.destructive ? '#E5484D' : theme.textPrimary} />
              <Text style={[styles.rowText, { color: action.destructive ? '#E5484D' : theme.textPrimary }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.cancelText, { color: theme.textPrimary }]}>Anulează</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32 },
  title: { fontSize: 12, fontWeight: '700', marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 14, fontWeight: '700' },
  cancel: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  cancelText: { fontSize: 13, fontWeight: '800' },
});
