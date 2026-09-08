import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { EventInvite } from '@/lib/eventInvitations';

const STATUS_LABEL: Record<EventInvite['status'], string> = {
  pending: 'În așteptare',
  accepted: 'Acceptată ✓',
  declined: 'Refuzată',
  cancelled: 'Anulată',
};

// Rendered inside a chat bubble in place of plain text whenever a message
// carries an event_invite_id (see messages.event_invite_id in the
// migration) — same idiom as PollCard/poll_id. `mine` is whoever SENT the
// chat message, i.e. the inviter; only the recipient sees Accept/Decline.
export function EventInviteCard({
  invite,
  mine,
  responding,
  onAccept,
  onDecline,
  onOpenEvent,
}: {
  invite: EventInvite;
  mine: boolean;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpenEvent: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const textColor = mine ? colors.white : theme.textPrimary;
  const secondaryColor = mine ? 'rgba(255,255,255,0.75)' : theme.textSecondary;

  return (
    <Pressable onPress={onOpenEvent} style={styles.card}>
      <Text style={[styles.title, { color: textColor }]}>🎉 Invitație la eveniment</Text>
      <Text style={[styles.eventTitle, { color: textColor }]} numberOfLines={2}>
        {invite.eventTitle || 'Eveniment'}
      </Text>
      {invite.status === 'pending' && !mine ? (
        <View style={styles.actions}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            disabled={responding}
            style={[styles.button, { backgroundColor: colors.green500 }]}
          >
            <Text style={styles.buttonTextLight}>Confirmă</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDecline();
            }}
            disabled={responding}
            style={[styles.button, styles.buttonOutline, { borderColor: 'rgba(255,255,255,0.5)' }]}
          >
            <Text style={[styles.buttonText, { color: textColor }]}>Refuză</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.status, { color: secondaryColor }]}>{STATUS_LABEL[invite.status]}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 200, gap: 6 },
  title: { fontSize: 12, fontWeight: '700' },
  eventTitle: { fontSize: 15, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  button: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  buttonText: { fontSize: 12, fontWeight: '800' },
  buttonTextLight: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
