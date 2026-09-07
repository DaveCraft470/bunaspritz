import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { DbGroupMessage } from '@/lib/eventMessaging';

// In-thread search over whatever's already loaded in groupMessages (the
// full thread is loaded up front for an event group chat — see messages.tsx
// — so no extra query is needed here, unlike getGroupMedia which is queried
// independently).
export function GroupSearchModal({
  visible,
  messages,
  senderName,
  onClose,
  onJump,
}: {
  visible: boolean;
  messages: DbGroupMessage[];
  senderName: (userId: string) => string;
  onClose: () => void;
  onJump: (messageId: string) => void;
}) {
  const { colors: theme } = useAppTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return messages
      .filter((m) => !m.is_system && !m.deleted_at && m.text.toLowerCase().includes(term))
      .slice()
      .reverse();
  }, [messages, query]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.page, { backgroundColor: theme.page }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={10} accessibilityLabel="Închide">
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <View style={[styles.searchBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Caută în conversație..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              autoFocus
            />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {query.trim() && results.length === 0 && (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Niciun rezultat.</Text>
          )}
          {results.map((message) => (
            <Pressable
              key={message.id}
              onPress={() => {
                handleClose();
                onJump(message.id);
              }}
              style={[styles.row, { borderColor: theme.border }]}
            >
              <Text style={[styles.rowSender, { color: theme.accent }]}>{senderName(message.sender_id)}</Text>
              <Text numberOfLines={2} style={[styles.rowText, { color: theme.textPrimary }]}>{message.text}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  empty: { textAlign: 'center', fontSize: 13, marginTop: 24 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowSender: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  rowText: { fontSize: 13, fontWeight: '600' },
});
