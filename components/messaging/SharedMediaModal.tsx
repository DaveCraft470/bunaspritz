import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getSignedMediaUrl } from '@/lib/messaging';
import { getGroupMedia, type DbGroupMessage } from '@/lib/eventMessaging';

const COLUMN_GAP = 6;

function Thumbnail({ message }: { message: DbGroupMessage }) {
  const [uri, setUri] = useState<string | null>(message.media_url);

  useEffect(() => {
    if (message.media_url) return;
    if (!message.media_path) return;
    let cancelled = false;
    getSignedMediaUrl(message.media_path).then((signed) => {
      if (!cancelled) setUri(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [message.media_path, message.media_url]);

  if (!uri) {
    return (
      <View style={[styles.thumb, styles.thumbLoading]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
}

// Gallery of every photo/GIF ever sent in this event's group chat — queried
// independently (getGroupMedia) rather than filtered from whatever's
// currently loaded in the open thread, so it works even before scrolling
// through the whole history.
export function SharedMediaModal({ visible, eventId, onClose }: { visible: boolean; eventId: string; onClose: () => void }) {
  const { colors: theme } = useAppTheme();
  const [media, setMedia] = useState<DbGroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getGroupMedia(eventId)
      .then(setMedia)
      .finally(() => setLoading(false));
  }, [visible, eventId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: theme.page }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Închide">
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Poze din grup</Text>
          <View style={{ width: 22 }} />
        </View>
        {loading ? (
          <ActivityIndicator color={colors.green500} style={styles.loading} />
        ) : media.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>Nu s-a trimis nicio poză sau GIF în acest grup.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {media.map((message) => (
              <Thumbnail key={message.id} message={message} />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 },
  title: { fontSize: 16, fontWeight: '800' },
  loading: { marginTop: 40 },
  empty: { textAlign: 'center', fontSize: 13, marginTop: 40, paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: COLUMN_GAP, paddingHorizontal: spacing.lg },
  thumb: { width: '32%', aspectRatio: 1, borderRadius: 8 },
  thumbLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
});
