import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { FriendPrefs } from '@/lib/social';

export function FriendPrefsModal({
  visible,
  friendName,
  prefs,
  onChange,
  onClose,
}: {
  visible: boolean;
  friendName: string;
  prefs: FriendPrefs;
  onChange: (patch: Partial<FriendPrefs>) => void;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{friendName}</Text>

          <View style={styles.row}>
            {/* This only suppresses the push notification — their messages
                still arrive and show up in the thread normally. The old
                copy ("no messages from them") implied actual blocking,
                which nothing in the app enforces. */}
            <Text style={[styles.label, { color: theme.textPrimary }]}>Fără notificări pentru mesajele lui/ei</Text>
            <Switch
              value={prefs.mute_messages}
              onValueChange={(value) => onChange({ mute_messages: value })}
              trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Fără notificări când merge la un Spritz</Text>
            <Switch
              value={prefs.mute_activity}
              onValueChange={(value) => onChange({ mute_activity: value })}
              trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
              thumbColor={colors.white}
            />
          </View>

          <View style={[styles.row, styles.rowLast]}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Ascunde activitatea mea de la el/ea</Text>
            <Switch
              value={prefs.hide_activity_from}
              onValueChange={(value) => onChange({ hide_activity_from: value })}
              trackColor={{ false: theme.surfaceMuted, true: colors.green500 }}
              thumbColor={colors.white}
            />
          </View>

          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.closeText, { color: theme.textPrimary }]}>Închide</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 12 },
  rowLast: { marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', flex: 1 },
  close: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  closeText: { fontSize: 13, fontWeight: '800' },
});
