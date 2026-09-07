import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { buildQrCodeUrl } from '@/lib/sharing';

// Shared by the event detail screen (Event QR) and the profile screen
// (Profile QR) — same deep-link-to-QR-image idiom either way, see
// lib/sharing.ts for why this needs no QR-generation library.
export function QrModal({
  visible,
  title,
  link,
  onClose,
}: {
  visible: boolean;
  title: string;
  link: string;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>{title}</Text>
          <View style={styles.qrWrap}>
            <Image source={{ uri: buildQrCodeUrl(link) }} style={styles.qrImage} resizeMode="contain" />
          </View>
          <Text style={[styles.link, { color: theme.textSecondary }]} numberOfLines={1}>{link}</Text>
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.green500 }]}>
            <Ionicons name="checkmark" size={16} color={colors.white} />
            <Text style={styles.closeText}>Gata</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 320, borderRadius: 22, borderWidth: 1, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  title: { fontSize: 15, fontWeight: '800' },
  qrWrap: { width: 200, height: 200, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qrImage: { width: 190, height: 190 },
  link: { fontSize: 11, maxWidth: 260 },
  close: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 22, paddingVertical: 11, marginTop: 4 },
  closeText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
