import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export function MusicCoverPlaceholder({ size = 44, title, style }: { size?: number; title?: string; style?: object }) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: Math.max(8, size * 0.18) }, style]}>
      <View style={[styles.record, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]}>
        <View style={styles.label} />
      </View>
      <Ionicons name="musical-note" size={Math.max(12, size * 0.34)} color={colors.green200} style={styles.note} />
      {title && <Text numberOfLines={1} style={styles.title}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#18251F', alignItems: 'center', justifyContent: 'center' },
  record: { backgroundColor: '#0B0D0F', borderWidth: 1, borderColor: 'rgba(159,239,190,0.45)', alignItems: 'center', justifyContent: 'center' },
  label: { width: '28%', height: '28%', borderRadius: 999, backgroundColor: colors.green500 },
  note: { position: 'absolute', right: '12%', top: '8%' },
  title: { position: 'absolute', left: 5, right: 5, bottom: 4, color: 'rgba(255,255,255,0.72)', fontSize: 7, fontWeight: '800', textAlign: 'center' },
});
