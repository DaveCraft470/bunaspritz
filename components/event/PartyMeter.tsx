import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getPartyMeter } from '@/lib/partyMeter';

export function PartyMeter({
  attendeeCount,
  maxParticipants,
  compact = false,
  showLabel = true,
}: {
  attendeeCount: number | null | undefined;
  maxParticipants: number | null | undefined;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const { colors: theme } = useAppTheme();
  const meter = getPartyMeter(attendeeCount, maxParticipants);
  if (!meter) return null;

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <View style={[styles.compactTrack, { backgroundColor: theme.surfaceMuted }]}>
          <View style={[styles.compactFill, { width: `${meter.percentage}%`, backgroundColor: colors.green500 }]} />
        </View>
        <Text numberOfLines={1} style={[styles.compactText, { color: theme.textSecondary }]}>
          {showLabel ? `${meter.label} · ${meter.percentage}%` : `${meter.percentage}%`}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.count, { color: theme.textPrimary }]}>
          {meter.attendeeCount} / {meter.maxParticipants} participanți
        </Text>
        <Text style={[styles.percentage, { color: theme.accent }]}>{meter.percentage}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.surface }]}>
        <View style={[styles.fill, { width: `${meter.percentage}%`, backgroundColor: colors.green500 }]} />
      </View>
      {showLabel && <Text style={[styles.label, { color: theme.textSecondary }]}>{meter.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, padding: spacing.md, gap: 8, marginTop: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  count: { flex: 1, fontSize: 14, fontWeight: '800' },
  percentage: { fontSize: 13, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '700' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, minWidth: 0 },
  compactTrack: { width: 46, height: 5, borderRadius: 3, overflow: 'hidden' },
  compactFill: { height: '100%', borderRadius: 3 },
  compactText: { flex: 1, fontSize: 10, fontWeight: '700' },
});
