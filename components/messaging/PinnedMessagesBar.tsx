import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { DbGroupMessage } from '@/lib/eventMessaging';

function previewText(message: DbGroupMessage): string {
  if (message.poll_id) return `📊 ${message.text || 'Sondaj'}`;
  if (message.media_type === 'image') return '📷 Poză';
  if (message.media_type === 'gif') return '🎞 GIF';
  return message.text;
}

// Collapsed strip under the chat header when the group has any pinned
// messages; tapping it opens the full list. Only the event host ever gets
// unpin here (see pin_group_message/unpin_group_message — enforced server-
// side too, this is just the UI gate).
export function PinnedMessagesBar({
  pinned,
  senderName,
  canUnpin,
  onJump,
  onUnpin,
}: {
  pinned: DbGroupMessage[];
  senderName: (userId: string) => string;
  canUnpin: boolean;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const { colors: theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  if (!pinned.length) return null;
  const latest = pinned[0];

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        style={[styles.strip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
      >
        <Ionicons name="pin" size={14} color={theme.accent} />
        <Text numberOfLines={1} style={[styles.stripText, { color: theme.textPrimary }]}>
          {previewText(latest)}
        </Text>
        {pinned.length > 1 && (
          <Text style={[styles.stripCount, { color: theme.textSecondary }]}>+{pinned.length - 1}</Text>
        )}
      </Pressable>

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExpanded(false)}>
          <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Mesaje fixate</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {pinned.map((message) => (
                <View key={message.id} style={[styles.row, { borderColor: theme.border }]}>
                  <Pressable
                    style={styles.rowBody}
                    onPress={() => {
                      setExpanded(false);
                      onJump(message.id);
                    }}
                  >
                    <Text style={[styles.rowSender, { color: theme.accent }]}>{senderName(message.sender_id)}</Text>
                    <Text numberOfLines={2} style={[styles.rowText, { color: theme.textPrimary }]}>
                      {previewText(message)}
                    </Text>
                  </Pressable>
                  {canUnpin && (
                    <Pressable onPress={() => onUnpin(message.id)} hitSlop={8} accessibilityLabel="Anulează fixarea">
                      <Ionicons name="close" size={18} color={theme.textSecondary} />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setExpanded(false)} style={[styles.cancel, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.cancelText, { color: theme.textPrimary }]}>Închide</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 22,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  stripText: { flex: 1, fontSize: 12, fontWeight: '700' },
  stripCount: { fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32, maxHeight: '70%' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1 },
  rowSender: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  rowText: { fontSize: 13, fontWeight: '600' },
  cancel: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  cancelText: { fontSize: 13, fontWeight: '800' },
});
