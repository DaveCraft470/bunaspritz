import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, type SchemeColors } from '@/constants/theme';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import type { Profile } from '@/lib/social';
import { getEventInvitationForPair } from '@/lib/eventInvitations';

export function EventInviteModal({
  visible,
  eventId,
  senderId,
  friends,
  joinedIds,
  theme,
  onClose,
  onSend,
}: {
  visible: boolean;
  eventId: string;
  senderId: string;
  friends: Profile[];
  joinedIds: Set<string>;
  theme: SchemeColors;
  onClose: () => void;
  onSend: (recipientIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  function close() {
    if (sending) return;
    setSelectedIds(new Set());
    onClose();
  }

  function toggleSelected(friendId: string) {
    const next = new Set(selectedIds);
    if (next.has(friendId)) next.delete(friendId);
    else next.add(friendId);
    setSelectedIds(next);
  }

  async function send() {
    if (!selectedIds.size || sending) return;
    setSending(true);
    await onSend([...selectedIds]);
    setSending(false);
    setSelectedIds(new Set());
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.42)' }]}> 
        <View style={[styles.sheet, { backgroundColor: theme.page }]}> 
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Invită prieteni</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Alege unul sau mai mulți prieteni pentru acest eveniment.</Text>
            </View>
            <Pressable onPress={close} disabled={sending} hitSlop={10} accessibilityLabel="Închide">
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={30} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nu ai încă prieteni pe care să-i inviți.</Text>
                <AnimatedPressable
                  onPress={() => {
                    close();
                    router.push('/friends');
                  }}
                  style={[styles.addFriendsButton, { borderColor: theme.border }]}
                >
                  <Text style={[styles.addFriendsText, { color: theme.accent }]}>Adaugă prieteni</Text>
                </AnimatedPressable>
              </View>
            ) : (
              friends.map((friend) => {
                const joined = joinedIds.has(friend.id);
                const invitation = getEventInvitationForPair(eventId, senderId, friend.id);
                const invited = invitation?.status === 'pending' || invitation?.status === 'accepted';
                const disabled = joined || invited;
                const selected = selectedIds.has(friend.id);
                return (
                  <AnimatedPressable
                    key={friend.id}
                    onPress={() => toggleSelected(friend.id)}
                    disabled={disabled || sending}
                    style={[
                      styles.friendRow,
                      {
                        backgroundColor: selected ? theme.surfaceMuted : theme.surface,
                        borderColor: selected ? colors.green500 : theme.border,
                        opacity: disabled ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Avatar uri={friend.avatar_url} name={friend.name} size={44} fontSize={17} />
                    <View style={styles.friendCopy}>
                      <Text style={[styles.friendName, { color: theme.textPrimary }]} numberOfLines={1}>{friend.name}</Text>
                      <Text style={[styles.friendUsername, { color: theme.textSecondary }]} numberOfLines={1}>@{friend.username}</Text>
                    </View>
                    {joined ? (
                      <Text style={[styles.statusText, { color: theme.textSecondary }]}>Participă deja</Text>
                    ) : invited ? (
                      <Text style={[styles.statusText, { color: theme.accent }]}>Invitat ✓</Text>
                    ) : (
                      <View style={[styles.checkbox, { borderColor: selected ? colors.green500 : theme.border, backgroundColor: selected ? colors.green500 : 'transparent' }]}>
                        {selected && <Ionicons name="checkmark" size={15} color={colors.white} />}
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <AnimatedPressable onPress={close} disabled={sending} style={[styles.cancelButton, { borderColor: theme.border }]}> 
              <Text style={[styles.cancelText, { color: theme.textPrimary }]}>Anulează</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={send}
              disabled={!selectedIds.size || sending}
              style={[styles.sendButton, { backgroundColor: colors.green500, opacity: !selectedIds.size || sending ? 0.55 : 1 }]}
            >
              <Text style={styles.sendText}>{sending ? 'Se trimit...' : `Trimite invitații${selectedIds.size ? ` (${selectedIds.size})` : ''}`}</Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: spacing.lg },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', marginBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  headerCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  list: { paddingBottom: spacing.md, gap: spacing.sm },
  friendRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 15, borderWidth: 1, padding: 10 },
  friendCopy: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: '800' },
  friendUsername: { fontSize: 11, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  addFriendsButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2 },
  addFriendsText: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderWidth: 1, borderRadius: 14 },
  cancelText: { fontSize: 13, fontWeight: '800' },
  sendButton: { flex: 1.35, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14, paddingHorizontal: 10 },
  sendText: { color: colors.white, fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
