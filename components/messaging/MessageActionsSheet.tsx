import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

const QUICK_EMOJI = ['❤️', '😂', '👍', '🔥', '🎉'];

export type MessageAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

// Long-press action sheet for one group-chat message bubble: a quick emoji
// row up top (same idiom as SafetyMenu's action list below it, just with an
// extra row) plus whichever actions apply to this message/viewer (reply is
// always available; edit/delete/pin are passed in already filtered by the
// caller based on ownership/host status).
export function MessageActionsSheet({
  visible,
  onClose,
  onReact,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  actions: MessageAction[];
}) {
  const { colors: theme } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
            {QUICK_EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  onClose();
                  setTimeout(() => onReact(emoji), 0);
                }}
                style={[styles.emojiButton, { backgroundColor: theme.surfaceMuted }]}
                accessibilityLabel={`Reacționează cu ${emoji}`}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
  emojiRow: { gap: 10, paddingBottom: spacing.md },
  emojiButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
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
